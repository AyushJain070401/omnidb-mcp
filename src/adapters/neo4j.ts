// ============================================================================
// Neo4j Graph Database Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class Neo4jAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'neo4j';
  private driver: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const neo4j = await import('neo4j-driver');
    this.config = config;

    const uri = config.connectionString ?? `bolt://${config.host ?? 'localhost'}:${config.port ?? 7687}`;
    const auth = config.username
      ? neo4j.default.auth.basic(config.username, config.password ?? '')
      : undefined;

    this.driver = neo4j.default.driver(uri, auth, {
      maxConnectionPoolSize: config.pool?.max ?? 50,
      connectionAcquisitionTimeout: config.pool?.acquireTimeoutMs ?? 10_000,
      connectionTimeout: 10_000,
      encrypted: config.ssl?.enabled ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
    });

    // Verify
    await this.driver.verifyConnectivity();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
    this.connected = false;
  }

  async query(cypher: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const session = this.driver.session({
      database: this.config?.database ?? 'neo4j',
      defaultAccessMode: this.config?.readOnly ? 'READ' : 'WRITE',
    });

    try {
      // Convert positional params to named params
      const namedParams: Record<string, unknown> = {};
      if (params) {
        params.forEach((val, i) => { namedParams[`p${i}`] = val; });
      }

      const result = await session.run(cypher, namedParams);
      const rows = result.records.map((record: any) => {
        const obj: Record<string, unknown> = {};
        for (const key of record.keys) {
          const val = record.get(key);
          obj[key] = this.serializeNeo4jValue(val);
        }
        return obj;
      });

      const { rows: limited, truncated } = this.truncateRows(rows);
      const columns = result.records.length > 0 ? result.records[0].keys : [];

      return {
        columns,
        rows: limited,
        rowCount: rows.length,
        executionTimeMs: elapsed(),
        truncated,
      };
    } finally {
      await session.close();
    }
  }

  private serializeNeo4jValue(val: any): unknown {
    if (val === null || val === undefined) return null;
    if (val.toNumber) return val.toNumber(); // Neo4j Integer
    if (val.properties) return { ...val.properties, _labels: val.labels, _id: val.identity?.toNumber?.() };
    if (val.start && val.end) return { type: val.type, start: val.start?.toNumber?.(), end: val.end?.toNumber?.(), properties: val.properties };
    if (Array.isArray(val)) return val.map(v => this.serializeNeo4jValue(v));
    return val;
  }

  async listTables(): Promise<TableInfo[]> {
    // In Neo4j, "tables" = node labels + relationship types
    const labelResult = await this.query('CALL db.labels()');
    const relResult = await this.query('CALL db.relationshipTypes()');

    const tables: TableInfo[] = [
      ...labelResult.rows.map((r: any) => ({
        name: r.label ?? Object.values(r)[0],
        type: 'node_label',
      })),
      ...relResult.rows.map((r: any) => ({
        name: r.relationshipType ?? Object.values(r)[0],
        type: 'relationship_type',
      })),
    ];

    return tables;
  }

  async describeTable(label: string): Promise<SchemaInfo> {
    // Sample nodes with this label to infer properties
    const result = await this.query(`MATCH (n:\`${label}\`) RETURN n LIMIT 100`);
    const propTypes = new Map<string, Set<string>>();

    for (const row of result.rows) {
      const node: any = row.n ?? Object.values(row)[0];
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (key.startsWith('_')) continue;
          if (!propTypes.has(key)) propTypes.set(key, new Set());
          propTypes.get(key)!.add(typeof value);
        }
      }
    }

    const columns: ColumnInfo[] = Array.from(propTypes.entries()).map(([name, types]) => ({
      name,
      type: Array.from(types).join(' | '),
      nullable: true,
      isPrimaryKey: false,
    }));

    return { table: label, columns };
  }

  async getVersion(): Promise<string> {
    const result = await this.query('CALL dbms.components() YIELD name, versions RETURN name, versions');
    const row: any = result.rows[0];
    return row ? `${row.name} ${row.versions?.[0] ?? ''}` : 'Neo4j unknown';
  }

  async ping(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }
}
