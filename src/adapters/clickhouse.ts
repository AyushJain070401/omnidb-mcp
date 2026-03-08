// ============================================================================
// ClickHouse Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class ClickHouseAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'clickhouse';
  private client: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { createClient } = await import('@clickhouse/client');
    this.config = config;

    this.client = createClient({
      url: config.connectionString ?? `http://${config.host ?? 'localhost'}:${config.port ?? 8123}`,
      username: config.username ?? 'default',
      password: config.password ?? '',
      database: config.database ?? 'default',
      request_timeout: config.queryTimeout ?? 30_000,
      max_open_connections: config.pool?.max ?? 10,
      ...(config.ssl?.enabled ? {
        tls: {
          ca_cert: config.ssl.ca ? Buffer.from(config.ssl.ca) : undefined,
        } as any,
      } : {}),
    });

    // Verify
    await this.client.ping();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();

    // ClickHouse uses {name: Type} for params
    const queryParams: Record<string, unknown> = {};
    let processedSQL = sql;
    if (params && params.length > 0) {
      params.forEach((val, i) => {
        queryParams[`p${i}`] = val;
        processedSQL = processedSQL.replace(`$${i + 1}`, `{p${i}: String}`);
      });
    }

    const result = await this.client.query({
      query: processedSQL,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    const { rows: limited, truncated } = this.truncateRows(rows);
    const columns = limited.length > 0 ? Object.keys(limited[0]) : [];

    return { columns, rows: limited, rowCount: rows.length, executionTimeMs: elapsed(), truncated };
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.query({
      query: `SELECT name, engine AS type, total_rows AS row_count, total_bytes AS size_bytes
              FROM system.tables
              WHERE database = currentDatabase()
              ORDER BY name`,
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    return rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      rowCount: Number(r.row_count),
      sizeBytes: Number(r.size_bytes),
    }));
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const result = await this.client.query({
      query: `SELECT name, type, default_kind, default_expression, is_in_primary_key, comment
              FROM system.columns
              WHERE database = currentDatabase() AND table = '${table.replace(/'/g, "''")}'
              ORDER BY position`,
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    const columns: ColumnInfo[] = rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      nullable: r.type.startsWith('Nullable'),
      defaultValue: r.default_expression || undefined,
      isPrimaryKey: Boolean(r.is_in_primary_key),
      comment: r.comment || undefined,
    }));

    return { table, columns };
  }

  async getVersion(): Promise<string> {
    const result = await this.client.query({ query: 'SELECT version()', format: 'JSONEachRow' });
    const rows = await result.json();
    return `ClickHouse ${rows[0]?.['version()'] ?? 'unknown'}`;
  }

  async ping(): Promise<boolean> {
    try {
      return await this.client.ping();
    } catch {
      return false;
    }
  }
}
