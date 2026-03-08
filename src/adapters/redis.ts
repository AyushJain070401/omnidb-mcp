// ============================================================================
// Redis Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class RedisAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'redis';
  private client: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const redis = await import('redis');
    this.config = config;

    const url = config.connectionString ??
      `redis://${config.username ? `${config.username}:${config.password}@` : ''}${config.host ?? 'localhost'}:${config.port ?? 6379}/${config.database ?? '0'}`;

    const options: any = { url };

    if (config.ssl?.enabled) {
      options.socket = {
        tls: true,
        rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
      };
    }

    this.client = redis.createClient(options);
    this.client.on('error', (err: Error) => console.error('[Redis]', err.message));
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();

    // Parse Redis commands: "GET key", "SET key value", "HGETALL key", etc.
    let cmd: { command: string; args: string[] };
    try {
      // Try JSON first: { "command": "GET", "args": ["mykey"] }
      cmd = JSON.parse(sql);
    } catch {
      // Parse as plain text command
      const parts = sql.trim().split(/\s+/);
      cmd = { command: parts[0].toUpperCase(), args: parts.slice(1) };
    }

    const allArgs = [...cmd.args, ...(params ?? []).map(String)];
    const result = await this.client.sendCommand([cmd.command, ...allArgs]);

    let rows: Record<string, unknown>[];

    if (result === null || result === undefined) {
      rows = [{ result: null }];
    } else if (Array.isArray(result)) {
      if (cmd.command === 'HGETALL' || cmd.command === 'CONFIG') {
        // Convert alternating key-value array to object
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < result.length; i += 2) {
          obj[String(result[i])] = result[i + 1];
        }
        rows = [obj];
      } else {
        rows = result.map((v, i) => ({ index: i, value: v }));
      }
    } else if (typeof result === 'object') {
      rows = [result as Record<string, unknown>];
    } else {
      rows = [{ result }];
    }

    const { rows: limited, truncated } = this.truncateRows(rows);

    return {
      columns: limited.length > 0 ? Object.keys(limited[0]) : ['result'],
      rows: limited,
      rowCount: limited.length,
      executionTimeMs: elapsed(),
      truncated,
    };
  }

  async listTables(): Promise<TableInfo[]> {
    // List key patterns via SCAN
    const keys: string[] = [];
    let cursor = 0;
    const limit = this.config?.maxRows ?? 1000;

    do {
      const result = await this.client.sendCommand(['SCAN', String(cursor), 'COUNT', '200']);
      cursor = parseInt(result[0], 10);
      keys.push(...result[1]);
    } while (cursor !== 0 && keys.length < limit);

    // Group by prefix
    const prefixes = new Map<string, number>();
    for (const key of keys) {
      const prefix = key.includes(':') ? key.split(':')[0] : key;
      prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
    }

    return Array.from(prefixes.entries())
      .map(([name, count]) => ({ name, type: 'keyspace' as string, rowCount: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async describeTable(pattern: string): Promise<SchemaInfo> {
    // Get sample keys matching pattern
    const result = await this.client.sendCommand(['SCAN', '0', 'MATCH', `${pattern}*`, 'COUNT', '100']);
    const keys: string[] = result[1].slice(0, 20);

    const columns: ColumnInfo[] = [];
    for (const key of keys) {
      const type = await this.client.sendCommand(['TYPE', key]);
      const ttl = await this.client.sendCommand(['TTL', key]);
      columns.push({
        name: key,
        type,
        nullable: false,
        isPrimaryKey: false,
        comment: ttl > 0 ? `TTL: ${ttl}s` : undefined,
      });
    }

    return { table: pattern, columns };
  }

  async getVersion(): Promise<string> {
    const info = await this.client.sendCommand(['INFO', 'server']);
    const match = info.match(/redis_version:(.+)/);
    return match ? `Redis ${match[1].trim()}` : 'Redis (unknown version)';
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
