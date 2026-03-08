// ============================================================================
// Oracle Database Adapter (uses oracledb)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class OracleAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'oracle';
  private pool: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const oracledb = await import('oracledb');
    this.config = config;

    oracledb.default.outFormat = oracledb.default.OUT_FORMAT_OBJECT;
    oracledb.default.autoCommit = true;
    oracledb.default.fetchAsString = [oracledb.default.CLOB];

    this.pool = await oracledb.default.createPool({
      user: config.username,
      password: config.password,
      connectString: config.connectionString ??
        `${config.host ?? 'localhost'}:${config.port ?? 1521}/${config.database ?? 'ORCL'}`,
      poolMin: config.pool?.min ?? 1,
      poolMax: config.pool?.max ?? 10,
      poolTimeout: Math.floor((config.pool?.idleTimeoutMs ?? 60_000) / 1000),
    });

    // Verify
    const conn = await this.pool.getConnection();
    await conn.close();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close(0);
      this.pool = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const conn = await this.pool.getConnection();
    try {
      const opts: any = { maxRows: this.config?.maxRows ?? 1000 };
      const result = params
        ? await conn.execute(sql, params, opts)
        : await conn.execute(sql, [], opts);

      const rows = result.rows ?? [];
      const { rows: limited, truncated } = this.truncateRows(rows);
      const columns = result.metaData?.map((m: any) => m.name) ?? [];

      return {
        columns,
        rows: limited,
        rowCount: rows.length,
        affectedRows: result.rowsAffected,
        executionTimeMs: elapsed(),
        truncated,
      };
    } finally {
      await conn.close();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT TABLE_NAME AS name, 'table' AS type, NUM_ROWS AS row_count
      FROM USER_TABLES
      UNION ALL
      SELECT VIEW_NAME AS name, 'view' AS type, NULL AS row_count
      FROM USER_VIEWS
      ORDER BY name
    `);

    return result.rows.map((r: any) => ({
      name: r.NAME ?? r.name,
      type: r.TYPE ?? r.type,
      rowCount: r.ROW_COUNT ?? r.row_count,
    }));
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const result = await this.query(`
      SELECT
        c.COLUMN_NAME AS name,
        c.DATA_TYPE AS type,
        CASE WHEN c.NULLABLE = 'Y' THEN 1 ELSE 0 END AS nullable,
        c.DATA_DEFAULT AS default_value,
        c.DATA_LENGTH AS max_length,
        CASE WHEN cc.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS is_pk
      FROM USER_TAB_COLUMNS c
      LEFT JOIN (
        SELECT cols.COLUMN_NAME
        FROM USER_CONSTRAINTS cons
        JOIN USER_CONS_COLUMNS cols ON cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
        WHERE cons.CONSTRAINT_TYPE = 'P' AND cons.TABLE_NAME = :1
      ) cc ON cc.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_NAME = :1
      ORDER BY c.COLUMN_ID
    `, [table.toUpperCase()]);

    const columns: ColumnInfo[] = result.rows.map((r: any) => ({
      name: r.NAME ?? r.name,
      type: r.TYPE ?? r.type,
      nullable: Boolean(r.NULLABLE ?? r.nullable),
      defaultValue: r.DEFAULT_VALUE ?? r.default_value,
      isPrimaryKey: Boolean(r.IS_PK ?? r.is_pk),
      maxLength: r.MAX_LENGTH ?? r.max_length,
    }));

    return { table, columns };
  }

  async getVersion(): Promise<string> {
    const result = await this.query('SELECT BANNER AS version FROM V$VERSION WHERE ROWNUM = 1');
    return (result.rows[0] as any)?.VERSION ?? (result.rows[0] as any)?.version ?? 'unknown';
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1 FROM DUAL');
      return true;
    } catch {
      return false;
    }
  }
}
