// ============================================================================
// InfluxDB Adapter (v2 API)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class InfluxDBAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'influxdb';
  private queryApi: any = null;
  private influx: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { InfluxDB } = await import('@influxdata/influxdb-client');
    this.config = config;

    const url = config.connectionString ?? `http://${config.host ?? 'localhost'}:${config.port ?? 8086}`;
    const token = config.password ?? (config.options?.token as string) ?? '';

    this.influx = new InfluxDB({ url, token });
    this.queryApi = this.influx.getQueryApi(config.options?.org as string ?? config.username ?? '');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.queryApi = null;
    this.influx = null;
    this.connected = false;
  }

  async query(flux: string): Promise<QueryResult> {
    const elapsed = this.startTimer();
    const rows: Record<string, unknown>[] = [];

    await new Promise<void>((resolve, reject) => {
      this.queryApi.queryRows(flux, {
        next(row: any, tableMeta: any) {
          rows.push(tableMeta.toObject(row));
        },
        error(error: Error) { reject(error); },
        complete() { resolve(); },
      });
    });

    const { rows: limited, truncated } = this.truncateRows(rows);
    const columns = limited.length > 0 ? Object.keys(limited[0]) : [];

    return { columns, rows: limited, rowCount: rows.length, executionTimeMs: elapsed(), truncated };
  }

  async listTables(): Promise<TableInfo[]> {
    const bucket = this.config?.database;
    const flux = `import "influxdata/influxdb/schema"
schema.measurements(bucket: "${bucket}")`;

    const result = await this.query(flux);
    return result.rows.map((r: any) => ({
      name: r._value ?? r.measurement ?? Object.values(r)[0] as string,
      type: 'measurement',
    }));
  }

  async describeTable(measurement: string): Promise<SchemaInfo> {
    const bucket = this.config?.database;
    const flux = `import "influxdata/influxdb/schema"
schema.measurementFieldKeys(bucket: "${bucket}", measurement: "${measurement}")`;

    const result = await this.query(flux);
    const columns: ColumnInfo[] = result.rows.map((r: any) => ({
      name: r._value ?? Object.values(r)[0] as string,
      type: 'field',
      nullable: true,
      isPrimaryKey: false,
    }));

    // Add standard InfluxDB columns
    columns.unshift(
      { name: '_time', type: 'dateTime:RFC3339', nullable: false, isPrimaryKey: true },
      { name: '_measurement', type: 'string', nullable: false, isPrimaryKey: false },
    );

    return { table: measurement, columns };
  }

  async getVersion(): Promise<string> {
    return 'InfluxDB v2';
  }

  async ping(): Promise<boolean> {
    try {
      const bucket = this.config?.database ?? 'default';
      await this.query(`from(bucket: "${bucket}") |> range(start: -1s) |> limit(n: 1)`);
      return true;
    } catch {
      return false;
    }
  }
}
