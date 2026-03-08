// ============================================================================
// Elasticsearch / OpenSearch Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class ElasticsearchAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'elasticsearch';
  private client: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { Client } = await import('@elastic/elasticsearch');
    this.config = config;

    const node = config.connectionString ??
      `${config.ssl?.enabled ? 'https' : 'http'}://${config.host ?? 'localhost'}:${config.port ?? 9200}`;

    const opts: any = { node };

    if (config.username) {
      opts.auth = { username: config.username, password: config.password };
    }

    if (config.ssl?.enabled) {
      opts.tls = {
        rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
        ca: config.ssl.ca,
      };
    }

    this.client = new Client(opts);
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

    let cmd: any;
    try {
      cmd = JSON.parse(sql);
    } catch {
      // Try as Elasticsearch SQL
      const result = await this.client.sql.query({ body: { query: sql } });
      const columns = result.columns?.map((c: any) => c.name) ?? [];
      const rows = (result.rows ?? []).map((row: any[]) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
        return obj;
      });
      const { rows: limited, truncated } = this.truncateRows(rows);
      return { columns, rows: limited, rowCount: rows.length, executionTimeMs: elapsed(), truncated };
    }

    // JSON DSL query
    const op = cmd.operation ?? 'search';
    let rows: Record<string, unknown>[] = [];
    let affectedRows: number | undefined;

    switch (op) {
      case 'search': {
        const result = await this.client.search({
          index: cmd.index,
          body: cmd.body ?? { query: cmd.query ?? { match_all: {} } },
          size: cmd.size ?? (this.config?.maxRows ?? 1000),
          from: cmd.from,
          sort: cmd.sort,
        });
        rows = result.hits.hits.map((hit: any) => ({
          _id: hit._id,
          _index: hit._index,
          _score: hit._score,
          ...hit._source,
        }));
        break;
      }
      case 'index': {
        const result = await this.client.index({
          index: cmd.index,
          id: cmd.id,
          body: cmd.document ?? cmd.body,
          refresh: cmd.refresh,
        });
        affectedRows = 1;
        rows = [{ _id: result._id, result: result.result }];
        break;
      }
      case 'delete': {
        const result = await this.client.delete({
          index: cmd.index,
          id: cmd.id,
          refresh: cmd.refresh,
        });
        affectedRows = 1;
        rows = [{ _id: result._id, result: result.result }];
        break;
      }
      case 'aggregate': {
        const result = await this.client.search({
          index: cmd.index,
          body: { size: 0, aggs: cmd.aggs ?? cmd.aggregations },
        });
        rows = [result.aggregations ?? {}];
        break;
      }
      default:
        throw new Error(`Unsupported Elasticsearch operation: ${op}`);
    }

    const { rows: limited, truncated } = this.truncateRows(rows);

    return {
      columns: limited.length > 0 ? Object.keys(limited[0]) : [],
      rows: limited,
      rowCount: rows.length,
      affectedRows,
      executionTimeMs: elapsed(),
      truncated,
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.cat.indices({ format: 'json' });

    return result.map((idx: any) => ({
      name: idx.index,
      type: 'index',
      rowCount: parseInt(idx['docs.count'] ?? '0', 10),
      sizeBytes: undefined,
    })).filter((t: any) => !t.name.startsWith('.'));
  }

  async describeTable(index: string): Promise<SchemaInfo> {
    const mapping = await this.client.indices.getMapping({ index });
    const properties = mapping[index]?.mappings?.properties ?? {};

    const columns: ColumnInfo[] = Object.entries(properties).map(([name, val]: [string, any]) => ({
      name,
      type: val.type ?? (val.properties ? 'object' : 'unknown'),
      nullable: true,
      isPrimaryKey: false,
    }));

    return { table: index, columns };
  }

  async getVersion(): Promise<string> {
    const info = await this.client.info();
    return `Elasticsearch ${info.version?.number ?? 'unknown'}`;
  }

  async ping(): Promise<boolean> {
    try {
      return await this.client.ping();
    } catch {
      return false;
    }
  }
}
