// ============================================================================
// PostgreSQL Adapter (also used for CockroachDB, Neon, Supabase, TimescaleDB)
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

export class PostgreSQLAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine;
  private pool: any = null;

  constructor(connectionId: string, engine: DatabaseEngine = 'postgresql') {
    super(connectionId);
    this.engine = engine;
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const pg = await import('pg');
    this.config = config;

    const poolConfig: any = {};

    if (config.connectionString) {
      poolConfig.connectionString = config.connectionString;
    } else {
      poolConfig.host = config.host ?? 'localhost';
      poolConfig.port = config.port ?? 5432;
      poolConfig.database = config.database ?? 'postgres';
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

    poolConfig.max = config.pool?.max ?? 10;
    poolConfig.min = config.pool?.min ?? 1;
    poolConfig.idleTimeoutMillis = config.pool?.idleTimeoutMs ?? 30_000;
    poolConfig.connectionTimeoutMillis = config.pool?.acquireTimeoutMs ?? 10_000;
    poolConfig.statement_timeout = config.queryTimeout ?? 30_000;

    this.pool = new pg.default.Pool(poolConfig);

    // Verify connection
    const client = await this.pool.connect();
    client.release();
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
    const result = await this.pool.query({
      text: sql,
      values: params,
      rowMode: undefined,
    });

    const rows = result.rows ?? [];
    const { rows: limited, truncated } = this.truncateRows(rows);
    const columns = result.fields?.map((f: any) => f.name) ?? [];

    return {
      columns,
      rows: limited,
      rowCount: rows.length,
      affectedRows: result.rowCount ?? undefined,
      executionTimeMs: elapsed(),
      truncated,
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.pool.query(`
      SELECT
        schemaname AS schema,
        tablename AS name,
        'table' AS type
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      UNION ALL
      SELECT
        schemaname AS schema,
        viewname AS name,
        'view' AS type
      FROM pg_views
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema, name
    `);

    return result.rows.map((r: any) => ({
      name: r.name,
      schema: r.schema,
      type: r.type,
    }));
  }

  async describeTable(table: string, schema = 'public'): Promise<SchemaInfo> {
    const colResult = await this.pool.query(`
      SELECT
        c.column_name AS name,
        c.data_type AS type,
        c.is_nullable = 'YES' AS nullable,
        c.column_default AS default_value,
        c.character_maximum_length AS max_length,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'PRIMARY KEY'
        ) AS is_primary_key,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2
            AND kcu.column_name = c.column_name
            AND tc.constraint_type = 'UNIQUE'
        ) AS is_unique
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [schema, table]);

    const columns: ColumnInfo[] = colResult.rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      nullable: r.nullable,
      defaultValue: r.default_value,
      isPrimaryKey: r.is_primary_key,
      isUnique: r.is_unique,
      maxLength: r.max_length,
    }));

    // Get foreign keys
    const fkResult = await this.pool.query(`
      SELECT
        tc.constraint_name AS name,
        kcu.column_name AS column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = $1 AND tc.table_name = $2
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [schema, table]);

    const foreignKeys = fkResult.rows.map((r: any) => ({
      name: r.name,
      columns: [r.column_name],
      referencedTable: r.referenced_table,
      referencedColumns: [r.referenced_column],
    }));

    return { table, schema, columns, foreignKeys };
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    );
    return result.rows.map((r: any) => r.schema_name);
  }

  async getVersion(): Promise<string> {
    const result = await this.pool.query('SELECT version()');
    return result.rows[0]?.version ?? 'unknown';
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
