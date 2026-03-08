// ============================================================================
// Apache Cassandra / ScyllaDB Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class CassandraAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'cassandra';
  private client: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const cassandra = await import('cassandra-driver');
    this.config = config;

    const contactPoints = config.host?.split(',') ?? ['localhost'];

    const options: any = {
      contactPoints,
      localDataCenter: (config.options?.datacenter as string) ?? 'datacenter1',
      keyspace: config.database,
      protocolOptions: { port: config.port ?? 9042 },
      pooling: {
        coreConnectionsPerHost: { 0: config.pool?.max ?? 2, 1: 1 },
      },
      socketOptions: {
        connectTimeout: config.pool?.acquireTimeoutMs ?? 10_000,
        readTimeout: config.queryTimeout ?? 30_000,
      },
    };

    if (config.username) {
      options.authProvider = new cassandra.auth.PlainTextAuthProvider(config.username, config.password ?? '');
    }

    if (config.ssl?.enabled) {
      options.sslOptions = {
        rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
      };
    }

    this.client = new cassandra.Client(options);
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const result = await this.client.execute(sql, params, { prepare: true });

    const rows = result.rows.map((r: any) => {
      const obj: Record<string, unknown> = {};
      for (const col of result.columns) {
        obj[col.name] = r[col.name];
      }
      return obj;
    });

    const { rows: limited, truncated } = this.truncateRows(rows);
    const columns = result.columns.map((c: any) => c.name);

    return { columns, rows: limited, rowCount: rows.length, executionTimeMs: elapsed(), truncated };
  }

  async listTables(): Promise<TableInfo[]> {
    const keyspace = this.config?.database;
    const result = await this.client.execute(
      `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`,
      [keyspace], { prepare: true }
    );

    return result.rows.map((r: any) => ({
      name: r.table_name,
      type: 'table',
    }));
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const keyspace = this.config?.database;
    const result = await this.client.execute(
      `SELECT column_name, type, kind FROM system_schema.columns
       WHERE keyspace_name = ? AND table_name = ?`,
      [keyspace, table], { prepare: true }
    );

    const columns: ColumnInfo[] = result.rows.map((r: any) => ({
      name: r.column_name,
      type: r.type,
      nullable: true,
      isPrimaryKey: r.kind === 'partition_key' || r.kind === 'clustering',
    }));

    return { table, columns };
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.client.execute(
      `SELECT keyspace_name FROM system_schema.keyspaces`
    );
    return result.rows.map((r: any) => r.keyspace_name).filter(
      (k: string) => !k.startsWith('system')
    );
  }

  async getVersion(): Promise<string> {
    const result = await this.client.execute(`SELECT release_version FROM system.local`);
    return `Cassandra ${result.rows[0]?.release_version ?? 'unknown'}`;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.execute('SELECT now() FROM system.local');
      return true;
    } catch {
      return false;
    }
  }
}
