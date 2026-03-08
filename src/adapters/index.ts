// ============================================================================
// Adapter Factory — creates the right adapter for each database engine
// ============================================================================

import type { DatabaseAdapter, DatabaseEngine, ConnectionConfig } from '../types/index.js';

const ENGINE_ALIASES: Record<string, DatabaseEngine> = {
  pg: 'postgresql',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
  mongodb: 'mongodb',
  mongo: 'mongodb',
  redis: 'redis',
  mssql: 'mssql',
  sqlserver: 'mssql',
  oracle: 'oracle',
  oracledb: 'oracle',
  cassandra: 'cassandra',
  scylladb: 'cassandra',
  clickhouse: 'clickhouse',
  neo4j: 'neo4j',
  dynamodb: 'dynamodb',
  elasticsearch: 'elasticsearch',
  opensearch: 'elasticsearch',
  couchdb: 'couchdb',
  influxdb: 'influxdb',
  firestore: 'firestore',
  supabase: 'postgresql',
  cockroachdb: 'postgresql',
  cockroach: 'postgresql',
  neon: 'postgresql',
  planetscale: 'mysql',
  tidb: 'mysql',
  singlestore: 'mysql',
  timescaledb: 'postgresql',
};

export function resolveEngine(input: string): DatabaseEngine {
  const normalized = input.toLowerCase().replace(/[\s\-_]/g, '');
  const resolved = ENGINE_ALIASES[normalized];
  if (!resolved) {
    const available = [...new Set(Object.values(ENGINE_ALIASES))].sort().join(', ');
    throw new Error(`Unknown database engine: "${input}". Available engines: ${available}`);
  }
  return resolved;
}

export async function createAdapter(config: ConnectionConfig): Promise<DatabaseAdapter> {
  const engine = resolveEngine(config.engine);
  const id = config.id;

  switch (engine) {
    case 'postgresql':
    case 'cockroachdb':
    case 'neon':
    case 'supabase': {
      const { PostgreSQLAdapter } = await import('./postgresql.js');
      return new PostgreSQLAdapter(id, config.engine as DatabaseEngine);
    }
    case 'mysql':
    case 'mariadb':
    case 'planetscale':
    case 'tidb':
    case 'singlestore': {
      const { MySQLAdapter } = await import('./mysql.js');
      return new MySQLAdapter(id, config.engine as DatabaseEngine);
    }
    case 'sqlite': {
      const { SQLiteAdapter } = await import('./sqlite.js');
      return new SQLiteAdapter(id);
    }
    case 'mongodb': {
      const { MongoDBAdapter } = await import('./mongodb.js');
      return new MongoDBAdapter(id);
    }
    case 'redis': {
      const { RedisAdapter } = await import('./redis.js');
      return new RedisAdapter(id);
    }
    case 'mssql': {
      const { MSSQLAdapter } = await import('./mssql.js');
      return new MSSQLAdapter(id);
    }
    case 'oracle': {
      const { OracleAdapter } = await import('./oracle.js');
      return new OracleAdapter(id);
    }
    case 'cassandra': {
      const { CassandraAdapter } = await import('./cassandra.js');
      return new CassandraAdapter(id);
    }
    case 'clickhouse': {
      const { ClickHouseAdapter } = await import('./clickhouse.js');
      return new ClickHouseAdapter(id);
    }
    case 'neo4j': {
      const { Neo4jAdapter } = await import('./neo4j.js');
      return new Neo4jAdapter(id);
    }
    case 'dynamodb': {
      const { DynamoDBAdapter } = await import('./dynamodb.js');
      return new DynamoDBAdapter(id);
    }
    case 'elasticsearch': {
      const { ElasticsearchAdapter } = await import('./elasticsearch.js');
      return new ElasticsearchAdapter(id);
    }
    case 'couchdb': {
      const { CouchDBAdapter } = await import('./couchdb.js');
      return new CouchDBAdapter(id);
    }
    case 'influxdb': {
      const { InfluxDBAdapter } = await import('./influxdb.js');
      return new InfluxDBAdapter(id);
    }
    case 'firestore': {
      const { FirestoreAdapter } = await import('./firestore.js');
      return new FirestoreAdapter(id);
    }
    default:
      throw new Error(`No adapter implemented for engine: ${engine}`);
  }
}

/** List all supported engines with categories */
export function listSupportedEngines(): { engine: string; category: string; aliases: string[] }[] {
  return [
    { engine: 'postgresql', category: 'Relational', aliases: ['pg', 'postgres'] },
    { engine: 'mysql', category: 'Relational', aliases: ['mysql'] },
    { engine: 'mariadb', category: 'Relational', aliases: ['mariadb'] },
    { engine: 'sqlite', category: 'Relational', aliases: ['sqlite3'] },
    { engine: 'mssql', category: 'Relational', aliases: ['sqlserver'] },
    { engine: 'oracle', category: 'Relational', aliases: ['oracledb'] },
    { engine: 'cockroachdb', category: 'NewSQL', aliases: ['cockroach'] },
    { engine: 'neon', category: 'Serverless SQL', aliases: [] },
    { engine: 'planetscale', category: 'Serverless SQL', aliases: [] },
    { engine: 'tidb', category: 'NewSQL', aliases: [] },
    { engine: 'singlestore', category: 'NewSQL', aliases: [] },
    { engine: 'supabase', category: 'BaaS (Postgres)', aliases: [] },
    { engine: 'mongodb', category: 'Document', aliases: ['mongo'] },
    { engine: 'couchdb', category: 'Document', aliases: [] },
    { engine: 'firestore', category: 'Document', aliases: [] },
    { engine: 'redis', category: 'Key-Value', aliases: [] },
    { engine: 'dynamodb', category: 'Key-Value', aliases: [] },
    { engine: 'cassandra', category: 'Wide Column', aliases: ['scylladb'] },
    { engine: 'clickhouse', category: 'Analytics', aliases: [] },
    { engine: 'elasticsearch', category: 'Search', aliases: ['opensearch'] },
    { engine: 'neo4j', category: 'Graph', aliases: [] },
    { engine: 'influxdb', category: 'Time Series', aliases: [] },
  ];
}
