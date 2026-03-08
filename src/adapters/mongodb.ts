// ============================================================================
// MongoDB Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class MongoDBAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'mongodb';
  private client: any = null;
  private db: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { MongoClient } = await import('mongodb');
    this.config = config;

    const uri = config.connectionString ??
      `mongodb://${config.username ? `${config.username}:${config.password}@` : ''}${config.host ?? 'localhost'}:${config.port ?? 27017}/${config.database ?? 'test'}`;

    const options: any = {
      maxPoolSize: config.pool?.max ?? 10,
      minPoolSize: config.pool?.min ?? 1,
      serverSelectionTimeoutMS: config.pool?.acquireTimeoutMs ?? 10_000,
      connectTimeoutMS: 10_000,
    };

    if (config.ssl?.enabled) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = !config.ssl.rejectUnauthorized;
      if (config.ssl.ca) options.tlsCAFile = config.ssl.caFile;
      if (config.ssl.cert) options.tlsCertificateKeyFile = config.ssl.certFile;
    }

    this.client = new MongoClient(uri, options);
    await this.client.connect();
    this.db = this.client.db(config.database ?? 'test');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();

    // Parse the "query" as a JSON command: { collection, operation, filter, ... }
    let cmd: any;
    try {
      cmd = JSON.parse(sql);
    } catch {
      throw new Error(
        'MongoDB queries must be JSON: { "collection": "users", "operation": "find", "filter": {}, "projection": {}, "sort": {}, "limit": 100 }'
      );
    }

    const collection = this.db.collection(cmd.collection);
    const op = cmd.operation ?? 'find';

    let rows: Record<string, unknown>[] = [];
    let affectedRows: number | undefined;

    switch (op) {
      case 'find': {
        const cursor = collection.find(cmd.filter ?? {}, {
          projection: cmd.projection,
          sort: cmd.sort,
          limit: cmd.limit ?? (this.config?.maxRows ?? 1000),
          skip: cmd.skip,
        });
        rows = await cursor.toArray();
        break;
      }
      case 'findOne': {
        const doc = await collection.findOne(cmd.filter ?? {}, { projection: cmd.projection });
        rows = doc ? [doc] : [];
        break;
      }
      case 'aggregate': {
        const pipeline = cmd.pipeline ?? [];
        rows = await collection.aggregate(pipeline).toArray();
        break;
      }
      case 'insertOne': {
        const result = await collection.insertOne(cmd.document ?? cmd.doc);
        affectedRows = result.acknowledged ? 1 : 0;
        rows = [{ insertedId: result.insertedId }];
        break;
      }
      case 'insertMany': {
        const result = await collection.insertMany(cmd.documents ?? cmd.docs);
        affectedRows = result.insertedCount;
        rows = [{ insertedCount: result.insertedCount, insertedIds: result.insertedIds }];
        break;
      }
      case 'updateOne': {
        const result = await collection.updateOne(cmd.filter ?? {}, cmd.update);
        affectedRows = result.modifiedCount;
        rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
        break;
      }
      case 'updateMany': {
        const result = await collection.updateMany(cmd.filter ?? {}, cmd.update);
        affectedRows = result.modifiedCount;
        rows = [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
        break;
      }
      case 'deleteOne': {
        const result = await collection.deleteOne(cmd.filter ?? {});
        affectedRows = result.deletedCount;
        rows = [{ deletedCount: result.deletedCount }];
        break;
      }
      case 'deleteMany': {
        const result = await collection.deleteMany(cmd.filter ?? {});
        affectedRows = result.deletedCount;
        rows = [{ deletedCount: result.deletedCount }];
        break;
      }
      case 'countDocuments': {
        const count = await collection.countDocuments(cmd.filter ?? {});
        rows = [{ count }];
        break;
      }
      case 'distinct': {
        const values = await collection.distinct(cmd.field, cmd.filter ?? {});
        rows = values.map((v: any) => ({ value: v }));
        break;
      }
      default:
        throw new Error(`Unsupported MongoDB operation: ${op}`);
    }

    const { rows: limited, truncated } = this.truncateRows(rows);

    return {
      columns: limited.length > 0 ? Object.keys(limited[0]) : [],
      rows: limited,
      rowCount: rows.length,
      affectedRows,
      executionTimeMs: elapsed(),
      truncated,
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const collections = await this.db.listCollections().toArray();
    const result: TableInfo[] = [];

    for (const col of collections) {
      const stats = await this.db.command({ collStats: col.name }).catch(() => null);
      result.push({
        name: col.name,
        type: col.type === 'view' ? 'view' : 'collection',
        rowCount: stats?.count,
        sizeBytes: stats?.size,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async describeTable(collection: string): Promise<SchemaInfo> {
    // Sample documents to infer schema
    const docs = await this.db.collection(collection).find({}).limit(100).toArray();

    const fieldTypes = new Map<string, Set<string>>();
    for (const doc of docs) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        fieldTypes.get(key)!.add(typeof value === 'object' && value !== null
          ? (Array.isArray(value) ? 'array' : value.constructor?.name ?? 'object')
          : typeof value);
      }
    }

    const columns: ColumnInfo[] = Array.from(fieldTypes.entries()).map(([name, types]) => ({
      name,
      type: Array.from(types).join(' | '),
      nullable: docs.some((d: any) => d[name] === null || d[name] === undefined),
      isPrimaryKey: name === '_id',
    }));

    // Get indexes
    const indexes = await this.db.collection(collection).indexes();
    const indexInfos = indexes.map((idx: any) => ({
      name: idx.name,
      columns: Object.keys(idx.key),
      unique: idx.unique ?? false,
      type: Object.values(idx.key).includes('text') ? 'text' : 'btree',
    }));

    return { table: collection, columns, indexes: indexInfos };
  }

  async listSchemas(): Promise<string[]> {
    const admin = this.client.db().admin();
    const result = await admin.listDatabases();
    return result.databases.map((db: any) => db.name);
  }

  async getVersion(): Promise<string> {
    const info = await this.db.command({ buildInfo: 1 });
    return `MongoDB ${info.version}`;
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
