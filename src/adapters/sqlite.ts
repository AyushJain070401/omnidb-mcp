// ============================================================================
// SQLite Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class SQLiteAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'sqlite';
  private db: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const Database = (await import('better-sqlite3')).default;
    this.config = config;

    const dbPath = config.connectionString ?? config.database ?? ':memory:';
    this.db = new Database(dbPath, {
      readonly: config.readOnly ?? false,
      timeout: config.queryTimeout ?? 30_000,
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const trimmed = sql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH') || trimmed.startsWith('EXPLAIN');

    if (isSelect) {
      const stmt = this.db.prepare(sql);
      const rows = params ? stmt.all(...params) : stmt.all();
      const { rows: limited, truncated } = this.truncateRows(rows);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return { columns, rows: limited, rowCount: rows.length, executionTimeMs: elapsed(), truncated };
    }

    const stmt = this.db.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();

    return {
      rows: [],
      rowCount: 0,
      affectedRows: result.changes,
      executionTimeMs: elapsed(),
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const rows = this.db.prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all();

    return rows.map((r: any) => ({ name: r.name, type: r.type }));
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const cols = this.db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all();
    const fks = this.db.prepare(`PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`).all();

    const columns: ColumnInfo[] = cols.map((c: any) => ({
      name: c.name,
      type: c.type,
      nullable: c.notnull === 0,
      defaultValue: c.dflt_value,
      isPrimaryKey: c.pk > 0,
    }));

    const foreignKeys = fks.map((f: any) => ({
      name: `fk_${f.id}`,
      columns: [f.from],
      referencedTable: f.table,
      referencedColumns: [f.to],
      onDelete: f.on_delete,
      onUpdate: f.on_update,
    }));

    return { table, columns, foreignKeys };
  }

  async getVersion(): Promise<string> {
    const row = this.db.prepare('SELECT sqlite_version() AS version').get();
    return row?.version ?? 'unknown';
  }

  async ping(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}
