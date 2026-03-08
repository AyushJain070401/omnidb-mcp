// ============================================================================
// omnidb-mcp-server — Type Definitions
// ============================================================================

/** Supported database engines */
export type DatabaseEngine =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlite'
  | 'mongodb'
  | 'redis'
  | 'mssql'
  | 'oracle'
  | 'cassandra'
  | 'clickhouse'
  | 'neo4j'
  | 'dynamodb'
  | 'elasticsearch'
  | 'couchdb'
  | 'influxdb'
  | 'firestore'
  | 'supabase'
  | 'cockroachdb'
  | 'neon'
  | 'planetscale'
  | 'tidb'
  | 'singlestore';

/** Connection configuration for any database */
export interface ConnectionConfig {
  /** Unique identifier for this connection */
  id: string;
  /** Database engine type */
  engine: DatabaseEngine;
  /** Connection string / URI (takes precedence over individual fields) */
  connectionString?: string;
  /** Hostname or IP */
  host?: string;
  /** Port number */
  port?: number;
  /** Database name / keyspace / index */
  database?: string;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** SSL/TLS configuration */
  ssl?: SSLConfig;
  /** Connection pool settings */
  pool?: PoolConfig;
  /** Additional engine-specific options */
  options?: Record<string, unknown>;
  /** Read-only mode (prevents writes) */
  readOnly?: boolean;
  /** Maximum query execution time in ms */
  queryTimeout?: number;
  /** Maximum rows returned per query */
  maxRows?: number;
  /** AWS region (for DynamoDB) */
  region?: string;
  /** Firebase project ID */
  projectId?: string;
  /** Path to service account key file */
  serviceAccountKeyPath?: string;
}

export interface SSLConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
  caFile?: string;
  certFile?: string;
  keyFile?: string;
}

export interface PoolConfig {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
}

/** Standardized query result */
export interface QueryResult {
  columns?: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  executionTimeMs: number;
  truncated?: boolean;
  warning?: string;
}

/** Table/collection metadata */
export interface TableInfo {
  name: string;
  schema?: string;
  type?: string; // 'table' | 'view' | 'collection' | 'index'
  rowCount?: number;
  sizeBytes?: number;
}

/** Column/field metadata */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey?: boolean;
  foreignKeyRef?: string;
  isUnique?: boolean;
  isIndexed?: boolean;
  comment?: string;
  maxLength?: number;
}

/** Schema description */
export interface SchemaInfo {
  table: string;
  schema?: string;
  columns: ColumnInfo[];
  primaryKey?: string[];
  indexes?: IndexInfo[];
  foreignKeys?: ForeignKeyInfo[];
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

/** Audit log entry */
export interface AuditEntry {
  timestamp: string;
  connectionId: string;
  engine: DatabaseEngine;
  operation: string;
  query?: string;
  params?: unknown[];
  executionTimeMs: number;
  rowsAffected?: number;
  success: boolean;
  error?: string;
  user?: string;
  ip?: string;
}

/** Security policy configuration */
export interface SecurityPolicy {
  /** Enable SQL injection detection */
  sqlInjectionProtection: boolean;
  /** Enable NoSQL injection detection */
  nosqlInjectionProtection: boolean;
  /** Maximum query length in characters */
  maxQueryLength: number;
  /** Blocked SQL keywords (e.g. DROP, TRUNCATE) */
  blockedKeywords: string[];
  /** Allowed schemas/databases */
  allowedSchemas?: string[];
  /** Blocked schemas/databases */
  blockedSchemas?: string[];
  /** Allow DDL statements (CREATE, ALTER, DROP) */
  allowDDL: boolean;
  /** Allow DML statements (INSERT, UPDATE, DELETE) */
  allowDML: boolean;
  /** Enable query audit logging */
  auditLogging: boolean;
  /** Rate limit: max queries per minute per connection */
  rateLimitPerMinute: number;
  /** Maximum number of concurrent connections */
  maxConnections: number;
  /** Enable parameterized query enforcement */
  enforceParameterizedQueries: boolean;
}

/** The abstract adapter interface all DB adapters implement */
export interface DatabaseAdapter {
  readonly engine: DatabaseEngine;
  readonly connectionId: string;

  /** Connect to the database */
  connect(config: ConnectionConfig): Promise<void>;

  /** Disconnect */
  disconnect(): Promise<void>;

  /** Check if connected */
  isConnected(): boolean;

  /** Execute a raw query with parameterized values */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;

  /** List all tables/collections */
  listTables(): Promise<TableInfo[]>;

  /** Describe a table/collection schema */
  describeTable(table: string, schema?: string): Promise<SchemaInfo>;

  /** List available schemas/databases */
  listSchemas?(): Promise<string[]>;

  /** Get server version info */
  getVersion?(): Promise<string>;

  /** Ping / health check */
  ping(): Promise<boolean>;
}

/** Server configuration */
export interface ServerConfig {
  /** Named database connections */
  connections: ConnectionConfig[];
  /** Global security policy */
  security: Partial<SecurityPolicy>;
  /** Server metadata */
  server?: {
    name?: string;
    version?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  };
}
