// ============================================================================
// Microsoft SQL Server Adapter (uses tedious)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class MSSQLAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'mssql';
  private connection: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { Connection, Request: TediousRequest } = await import('tedious');
    this.config = config;

    return new Promise((resolve, reject) => {
      const tediousConfig: any = {
        server: config.host ?? 'localhost',
        authentication: {
          type: 'default',
          options: {
            userName: config.username,
            password: config.password,
          },
        },
        options: {
          database: config.database,
          port: config.port ?? 1433,
          encrypt: config.ssl?.enabled ?? true,
          trustServerCertificate: !(config.ssl?.rejectUnauthorized ?? true),
          connectTimeout: config.pool?.acquireTimeoutMs ?? 15_000,
          requestTimeout: config.queryTimeout ?? 30_000,
          rowCollectionOnDone: true,
          rowCollectionOnRequestCompletion: true,
        },
      };

      this.connection = new Connection(tediousConfig);
      this.connection.on('connect', (err: Error | null) => {
        if (err) return reject(err);
        this.connected = true;
        resolve();
      });
      this.connection.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const { Request: TediousRequest, TYPES } = await import('tedious');
    const elapsed = this.startTimer();

    return new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      let columns: string[] = [];

      const request = new TediousRequest(sql, (err: any, rowCount?: number) => {
        if (err) return reject(err);
        const { rows: limited, truncated } = this.truncateRows(rows);
        resolve({
          columns,
          rows: limited,
          rowCount: rows.length,
          affectedRows: rowCount ?? 0,
          executionTimeMs: elapsed(),
          truncated,
        });
      });

      // Bind parameters
      if (params) {
        params.forEach((val, i) => {
          const type = typeof val === 'number' ? (Number.isInteger(val) ? TYPES.Int : TYPES.Float)
            : typeof val === 'boolean' ? TYPES.Bit
            : val instanceof Date ? TYPES.DateTime
            : TYPES.NVarChar;
          request.addParameter(`p${i}`, type, val);
        });
      }

      request.on('row', (tediousCols: any[]) => {
        const row: Record<string, unknown> = {};
        for (const col of tediousCols) {
          row[col.metadata.colName] = col.value;
        }
        rows.push(row);
        if (columns.length === 0) {
          columns = tediousCols.map((c: any) => c.metadata.colName);
        }
      });

      this.connection.execSql(request);
    });
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS name, TABLE_TYPE AS type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    return result.rows.map((r: any) => ({
      name: r.name,
      schema: r.schema,
      type: r.type === 'BASE TABLE' ? 'table' : 'view',
    }));
  }

  async describeTable(table: string, schema = 'dbo'): Promise<SchemaInfo> {
    const result = await this.query(`
      SELECT
        c.COLUMN_NAME AS name,
        c.DATA_TYPE AS type,
        CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable,
        c.COLUMN_DEFAULT AS default_value,
        c.CHARACTER_MAXIMUM_LENGTH AS max_length,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @p0 AND tc.TABLE_NAME = @p1
      ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = @p0 AND c.TABLE_NAME = @p1
      ORDER BY c.ORDINAL_POSITION
    `, [schema, table]);

    const columns: ColumnInfo[] = result.rows.map((r: any) => ({
      name: r.name,
      type: r.type,
      nullable: Boolean(r.nullable),
      defaultValue: r.default_value,
      isPrimaryKey: Boolean(r.is_primary_key),
      maxLength: r.max_length ? Number(r.max_length) : undefined,
    }));

    return { table, schema, columns };
  }

  async getVersion(): Promise<string> {
    const result = await this.query('SELECT @@VERSION AS version');
    return result.rows[0]?.version as string ?? 'unknown';
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1 AS ping');
      return true;
    } catch {
      return false;
    }
  }
}
