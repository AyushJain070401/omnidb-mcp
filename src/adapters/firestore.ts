// ============================================================================
// Google Cloud Firestore Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class FirestoreAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'firestore';
  private db: any = null;
  private app: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const admin = await import('firebase-admin');
    this.config = config;

    const opts: any = { projectId: config.projectId ?? config.database };

    if (config.serviceAccountKeyPath) {
      const fs = await import('fs');
      const key = JSON.parse(fs.readFileSync(config.serviceAccountKeyPath, 'utf-8'));
      opts.credential = admin.default.credential.cert(key);
    }

    this.app = admin.default.initializeApp(opts, `mcp-${config.id}-${Date.now()}`);
    this.db = this.app.firestore();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.app) {
      await this.app.delete();
      this.app = null;
      this.db = null;
    }
    this.connected = false;
  }

  async query(sql: string): Promise<QueryResult> {
    const elapsed = this.startTimer();

    let cmd: any;
    try { cmd = JSON.parse(sql); } catch {
      throw new Error('Firestore commands must be JSON: { "operation": "get|list|add|set|update|delete|query", "collection": "...", ... }');
    }

    let rows: Record<string, unknown>[] = [];
    let affectedRows: number | undefined;
    const collRef = this.db.collection(cmd.collection);

    switch (cmd.operation) {
      case 'list': {
        let q = collRef.limit(cmd.limit ?? (this.config?.maxRows ?? 100));
        if (cmd.orderBy) q = q.orderBy(cmd.orderBy, cmd.order ?? 'asc');
        if (cmd.offset) q = q.offset(cmd.offset);
        const snapshot = await q.get();
        rows = snapshot.docs.map((d: any) => ({ _id: d.id, ...d.data() }));
        break;
      }
      case 'get': {
        const doc = await collRef.doc(cmd.id).get();
        rows = doc.exists ? [{ _id: doc.id, ...doc.data() }] : [];
        break;
      }
      case 'query': {
        let q: any = collRef;
        for (const w of cmd.where ?? []) {
          q = q.where(w.field, w.op, w.value);
        }
        if (cmd.orderBy) q = q.orderBy(cmd.orderBy, cmd.order ?? 'asc');
        q = q.limit(cmd.limit ?? 100);
        const snap = await q.get();
        rows = snap.docs.map((d: any) => ({ _id: d.id, ...d.data() }));
        break;
      }
      case 'add': {
        const ref = await collRef.add(cmd.data ?? cmd.document);
        affectedRows = 1;
        rows = [{ _id: ref.id, status: 'created' }];
        break;
      }
      case 'set': {
        await collRef.doc(cmd.id).set(cmd.data ?? cmd.document, { merge: cmd.merge ?? false });
        affectedRows = 1;
        rows = [{ _id: cmd.id, status: 'set' }];
        break;
      }
      case 'update': {
        await collRef.doc(cmd.id).update(cmd.data ?? cmd.document);
        affectedRows = 1;
        rows = [{ _id: cmd.id, status: 'updated' }];
        break;
      }
      case 'delete': {
        await collRef.doc(cmd.id).delete();
        affectedRows = 1;
        rows = [{ _id: cmd.id, status: 'deleted' }];
        break;
      }
      default:
        throw new Error(`Unsupported Firestore operation: ${cmd.operation}`);
    }

    const { rows: limited, truncated } = this.truncateRows(rows);
    return {
      columns: limited.length > 0 ? Object.keys(limited[0]) : [],
      rows: limited, rowCount: rows.length, affectedRows, executionTimeMs: elapsed(), truncated,
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const collections = await this.db.listCollections();
    return collections.map((c: any) => ({ name: c.id, type: 'collection' }));
  }

  async describeTable(collection: string): Promise<SchemaInfo> {
    const snapshot = await this.db.collection(collection).limit(50).get();
    const fieldTypes = new Map<string, Set<string>>();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      for (const [key, value] of Object.entries(data)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        fieldTypes.get(key)!.add(typeof value === 'object' && value !== null
          ? (Array.isArray(value) ? 'array' : value.constructor?.name ?? 'object')
          : typeof value);
      }
    }

    const columns: ColumnInfo[] = [
      { name: '_id', type: 'string', nullable: false, isPrimaryKey: true },
      ...Array.from(fieldTypes.entries()).map(([name, types]) => ({
        name, type: Array.from(types).join(' | '), nullable: true, isPrimaryKey: false,
      })),
    ];

    return { table: collection, columns };
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.listCollections();
      return true;
    } catch {
      return false;
    }
  }
}
