// ============================================================================
// Apache CouchDB Adapter (uses nano)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class CouchDBAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'couchdb';
  private nano: any = null;
  private db: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const nanoLib = await import('nano');
    this.config = config;

    const url = config.connectionString ??
      `${config.ssl?.enabled ? 'https' : 'http'}://${config.username ? `${config.username}:${config.password}@` : ''}${config.host ?? 'localhost'}:${config.port ?? 5984}`;

    this.nano = nanoLib.default(url);
    if (config.database) {
      this.db = this.nano.db.use(config.database);
    }
    // Verify
    await this.nano.db.list();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.nano = null;
    this.db = null;
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();

    let cmd: any;
    try { cmd = JSON.parse(sql); } catch {
      throw new Error('CouchDB commands must be JSON: { "operation": "find|get|insert|delete|view", ... }');
    }

    let rows: Record<string, unknown>[] = [];
    let affectedRows: number | undefined;

    switch (cmd.operation) {
      case 'find': {
        const result = await this.db.find({ selector: cmd.selector ?? {}, limit: cmd.limit ?? 100, fields: cmd.fields, sort: cmd.sort });
        rows = result.docs;
        break;
      }
      case 'get': {
        const doc = await this.db.get(cmd.id);
        rows = [doc];
        break;
      }
      case 'insert': {
        const result = await this.db.insert(cmd.document ?? cmd.doc);
        affectedRows = 1;
        rows = [{ id: result.id, rev: result.rev, ok: result.ok }];
        break;
      }
      case 'delete': {
        const result = await this.db.destroy(cmd.id, cmd.rev);
        affectedRows = 1;
        rows = [{ id: result.id, rev: result.rev, ok: result.ok }];
        break;
      }
      case 'view': {
        const result = await this.db.view(cmd.designDoc, cmd.viewName, cmd.params ?? {});
        rows = result.rows.map((r: any) => ({ id: r.id, key: r.key, value: r.value }));
        break;
      }
      case 'allDocs': {
        const result = await this.db.list({ include_docs: cmd.includeDocs ?? true, limit: cmd.limit ?? 100 });
        rows = result.rows.map((r: any) => cmd.includeDocs ? r.doc : { id: r.id, key: r.key });
        break;
      }
      default:
        throw new Error(`Unsupported CouchDB operation: ${cmd.operation}`);
    }

    const { rows: limited, truncated } = this.truncateRows(rows);
    return { columns: limited.length > 0 ? Object.keys(limited[0]) : [], rows: limited, rowCount: rows.length, affectedRows, executionTimeMs: elapsed(), truncated };
  }

  async listTables(): Promise<TableInfo[]> {
    const dbs = await this.nano.db.list();
    const tables: TableInfo[] = [];
    for (const name of dbs) {
      if (name.startsWith('_')) continue;
      try {
        const info = await this.nano.db.get(name);
        tables.push({ name, type: 'database', rowCount: info.doc_count, sizeBytes: info.sizes?.active });
      } catch { tables.push({ name, type: 'database' }); }
    }
    return tables;
  }

  async describeTable(database: string): Promise<SchemaInfo> {
    const db = this.nano.db.use(database);
    const result = await db.list({ include_docs: true, limit: 50 });
    const fieldTypes = new Map<string, Set<string>>();
    for (const row of result.rows) {
      if (!(row as any).doc) continue;
      for (const [key, value] of Object.entries((row as any).doc)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        fieldTypes.get(key)!.add(typeof value);
      }
    }
    const columns: ColumnInfo[] = Array.from(fieldTypes.entries()).map(([name, types]) => ({
      name, type: Array.from(types).join(' | '), nullable: true, isPrimaryKey: name === '_id',
    }));
    return { table: database, columns };
  }

  async getVersion(): Promise<string> {
    const info = await this.nano.request({ path: '/' });
    return `CouchDB ${info.version ?? 'unknown'}`;
  }

  async ping(): Promise<boolean> {
    try { await this.nano.db.list(); return true; } catch { return false; }
  }
}
