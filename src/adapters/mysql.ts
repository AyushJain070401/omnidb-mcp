// ============================================================================
// MySQL Adapter (also used for MariaDB, PlanetScale, TiDB, SingleStore)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig,
  QueryResult,
  TableInfo,
  SchemaInfo,
  ColumnInfo,
  DatabaseEngine,
} from '../types/index.js';

export class MySQLAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine;
  private pool: any = null;

  constructor(connectionId: string, engine: DatabaseEngine = 'mysql') {
    super(connectionId);
    this.engine = engine;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const mysql = await import('mysql2/promise');
    this.config = config;

    const poolConfig: any = {
      waitForConnections: true,
      connectionLimit: config.pool?.max ?? 10,
      queueLimit: 0,
    };

    if (config.connectionString) {
      poolConfig.uri = config.connectionString;
    } else {
      poolConfig.host = config.host ?? 'localhost';
      poolConfig.port = config.port ?? 3306;
      poolConfig.database = config.database;
      poolConfig.user = config.username;
      poolConfig.password = config.password;
    }

    if (config.ssl?.enabled) {
      poolConfig.ssl = {
        rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
        ca: config.ssl.ca,
        cert: config.ssl.cert,
        key: config.ssl.key,
      };
    }

    this.pool = mysql.createPool(poolConfig);

    // Verify connection
    const conn = await this.pool.getConnection();
    conn.release();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const [rows, fields] = await this.pool.execute(sql, params);

    if (Array.isArray(rows)) {
      const { rows: limited, truncated } = this.truncateRows(rows as any[]);
      const columns = fields?.map((f: any) => f.name) ?? [];

      return {
        columns,
        rows: limited,
        rowCount: (rows as any[]).length,
        executionTimeMs: elapsed(),
        truncated,
      };
    }

    // INSERT/UPDATE/DELETE result
    return {
      rows: [],
      rowCount: 0,
      affectedRows: (rows as any).affectedRows,
      executionTimeMs: elapsed(),
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const db = this.config?.database;
    const [rows] = await this.pool.execute(`
      SELECT
        TABLE_NAME AS name,
        TABLE_SCHEMA AS \`schema\`,
        TABLE_TYPE AS type,
        TABLE_ROWS AS row_count,
        DATA_LENGTH AS size_bytes
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [db]);

    return (rows as any[]).map(r => ({
      name: r.name,
      schema: r.schema,
      type: r.type === 'BASE TABLE' ? 'table' : 'view',
      rowCount: r.row_count ? Number(r.row_count) : undefined,
      sizeBytes: r.size_bytes ? Number(r.size_bytes) : undefined,
    }));
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const db = this.config?.database;

    const [cols] = await this.pool.execute(`
      SELECT
        COLUMN_NAME AS name,
        DATA_TYPE AS type,
        IS_NULLABLE = 'YES' AS nullable,
        COLUMN_DEFAULT AS default_value,
        CHARACTER_MAXIMUM_LENGTH AS max_length,
        COLUMN_KEY = 'PRI' AS is_primary_key,
        COLUMN_KEY = 'UNI' AS is_unique,
        COLUMN_COMMENT AS comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [db, table]);

    const columns: ColumnInfo[] = (cols as any[]).map(r => ({
      name: r.name,
      type: r.type,
      nullable: Boolean(r.nullable),
      defaultValue: r.default_value,
      isPrimaryKey: Boolean(r.is_primary_key),
      isUnique: Boolean(r.is_unique),
      maxLength: r.max_length ? Number(r.max_length) : undefined,
      comment: r.comment || undefined,
    }));

    // Foreign keys
    const [fks] = await this.pool.execute(`
      SELECT
        CONSTRAINT_NAME AS name,
        COLUMN_NAME AS column_name,
        REFERENCED_TABLE_NAME AS referenced_table,
        REFERENCED_COLUMN_NAME AS referenced_column
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [db, table]);

    const foreignKeys = (fks as any[]).map(r => ({
      name: r.name,
      columns: [r.column_name],
      referencedTable: r.referenced_table,
      referencedColumns: [r.referenced_column],
    }));

    return { table, columns, foreignKeys };
  }

  async listSchemas(): Promise<string[]> {
    const [rows] = await this.pool.execute(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY SCHEMA_NAME`
    );
    return (rows as any[]).map(r => r.SCHEMA_NAME);
  }

  async getVersion(): Promise<string> {
    const [rows] = await this.pool.execute('SELECT VERSION() AS version');
    return (rows as any[])[0]?.version ?? 'unknown';
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
