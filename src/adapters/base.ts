// ============================================================================
// Base Database Adapter — shared logic for all adapters
// ============================================================================

import type {
  DatabaseAdapter,
  DatabaseEngine,
  ConnectionConfig,
  QueryResult,
  TableInfo,
  SchemaInfo,
} from '../types/index.js';

export abstract class BaseAdapter implements DatabaseAdapter {
  abstract readonly engine: DatabaseEngine;
  readonly connectionId: string;
  protected config: ConnectionConfig | null = null;
  protected connected = false;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  abstract connect(config: ConnectionConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(sql: string, params?: unknown[]): Promise<QueryResult>;
  abstract listTables(): Promise<TableInfo[]>;
  abstract describeTable(table: string, schema?: string): Promise<SchemaInfo>;
  abstract ping(): Promise<boolean>;

  isConnected(): boolean {
    return this.connected;
  }

  /** Safe timer for query execution measurement */
  protected startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }

  /** Truncate result rows to maxRows */
  protected truncateRows(rows: Record<string, unknown>[], maxRows?: number): {
    rows: Record<string, unknown>[];
    truncated: boolean;
  } {
    const limit = maxRows ?? this.config?.maxRows ?? 1000;
    if (rows.length > limit) {
      return { rows: rows.slice(0, limit), truncated: true };
    }
    return { rows, truncated: false };
  }

  /** Apply query timeout as AbortSignal or similar */
  protected getTimeoutMs(): number {
    return this.config?.queryTimeout ?? 30_000;
  }
}
