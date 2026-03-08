#!/usr/bin/env node
// ============================================================================
// omnidb-mcp-server
// Universal Database MCP Server — connect any LLM to 20+ databases
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { DatabaseAdapter, ConnectionConfig, SecurityPolicy } from './types/index.js';
import { createAdapter, listSupportedEngines, resolveEngine } from './adapters/index.js';
import {
  RateLimiter,
  AuditLogger,
  validateQuery,
  sanitizeIdentifier,
  maskSensitiveConfig,
  isSchemaAllowed,
  DEFAULT_SECURITY_POLICY,
  detectNoSQLInjection,
} from './security/index.js';
import { loadConfig, mergeSecurityPolicy } from './utils/config.js';

// ─── State ──────────────────────────────────────────────────────────────────

const adapters = new Map<string, DatabaseAdapter>();
const config = loadConfig();
const security: SecurityPolicy = mergeSecurityPolicy(config.security);
const rateLimiter = new RateLimiter(security.rateLimitPerMinute);
const auditLogger = new AuditLogger(security.auditLogging);

// ─── Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: config.server?.name ?? 'mcp-database-server',
  version: config.server?.version ?? '1.0.0',
});

// ─── Helper: get adapter or throw ───────────────────────────────────────────

function getAdapter(connectionId: string): DatabaseAdapter {
  const adapter = adapters.get(connectionId);
  if (!adapter) {
    const available = Array.from(adapters.keys());
    throw new Error(
      `Connection "${connectionId}" not found. ` +
      (available.length > 0
        ? `Available connections: ${available.join(', ')}`
        : 'No active connections. Use the "connect" tool first.')
    );
  }
  if (!adapter.isConnected()) {
    throw new Error(`Connection "${connectionId}" is no longer active. Reconnect first.`);
  }
  return adapter;
}

function checkRateLimit(connectionId: string): void {
  if (!rateLimiter.check(connectionId)) {
    throw new Error(
      `Rate limit exceeded for connection "${connectionId}". ` +
      `Maximum ${security.rateLimitPerMinute} queries per minute. ` +
      `Remaining: ${rateLimiter.remaining(connectionId)}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: list_supported_databases
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'list_supported_databases',
  'List all supported database engines with categories and aliases',
  {},
  async () => {
    const engines = listSupportedEngines();
    const grouped = new Map<string, typeof engines>();
    for (const e of engines) {
      if (!grouped.has(e.category)) grouped.set(e.category, []);
      grouped.get(e.category)!.push(e);
    }

    let text = '# Supported Database Engines\n\n';
    for (const [category, items] of grouped) {
      text += `## ${category}\n`;
      for (const item of items) {
        const aliases = item.aliases.length > 0 ? ` (aliases: ${item.aliases.join(', ')})` : '';
        text += `- **${item.engine}**${aliases}\n`;
      }
      text += '\n';
    }

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: connect
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'connect',
  'Connect to a database. Returns a connection ID for use in subsequent calls.',
  {
    connection_id: z.string().min(1).max(64).describe('Unique name for this connection (e.g. "prod-postgres", "analytics-clickhouse")'),
    engine: z.string().describe('Database engine (e.g. postgresql, mysql, sqlite, mongodb, redis, mssql, oracle, cassandra, clickhouse, neo4j, dynamodb, elasticsearch, couchdb, influxdb, firestore, cockroachdb, neon, supabase, planetscale, tidb, singlestore)'),
    connection_string: z.string().optional().describe('Full connection URI (e.g. postgresql://user:pass@host:5432/db). Takes precedence over individual fields.'),
    host: z.string().optional().describe('Hostname or IP'),
    port: z.number().optional().describe('Port number'),
    database: z.string().optional().describe('Database name / keyspace / bucket / index'),
    username: z.string().optional().describe('Username'),
    password: z.string().optional().describe('Password or auth token'),
    ssl: z.boolean().optional().describe('Enable SSL/TLS (default: false)'),
    read_only: z.boolean().optional().describe('Read-only mode — prevents INSERT/UPDATE/DELETE (default: false)'),
    region: z.string().optional().describe('AWS region (for DynamoDB)'),
    project_id: z.string().optional().describe('GCP project ID (for Firestore)'),
  },
  async (params) => {
    if (adapters.size >= security.maxConnections) {
      throw new Error(`Maximum connections (${security.maxConnections}) reached. Disconnect one first.`);
    }

    if (adapters.has(params.connection_id)) {
      throw new Error(`Connection "${params.connection_id}" already exists. Disconnect it first or use a different ID.`);
    }

    const connConfig: ConnectionConfig = {
      id: params.connection_id,
      engine: resolveEngine(params.engine),
      connectionString: params.connection_string,
      host: params.host,
      port: params.port,
      database: params.database,
      username: params.username,
      password: params.password,
      ssl: params.ssl ? { enabled: true } : undefined,
      readOnly: params.read_only,
      region: params.region,
      projectId: params.project_id,
    };

    const adapter = await createAdapter(connConfig);
    await adapter.connect(connConfig);
    adapters.set(params.connection_id, adapter);

    auditLogger.log({
      connectionId: params.connection_id,
      engine: adapter.engine,
      operation: 'CONNECT',
      executionTimeMs: 0,
      success: true,
    });

    const version = adapter.getVersion ? await adapter.getVersion().catch(() => 'unknown') : 'unknown';

    return {
      content: [{
        type: 'text',
        text: `✅ Connected to **${adapter.engine}** as \`${params.connection_id}\`\n` +
              `Server version: ${version}\n` +
              `Read-only: ${params.read_only ?? false}\n` +
              `SSL: ${params.ssl ?? false}`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: disconnect
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'disconnect',
  'Disconnect from a database and release resources',
  {
    connection_id: z.string().describe('The connection ID to disconnect'),
  },
  async (params) => {
    const adapter = adapters.get(params.connection_id);
    if (!adapter) {
      return { content: [{ type: 'text', text: `Connection "${params.connection_id}" not found.` }] };
    }

    await adapter.disconnect();
    adapters.delete(params.connection_id);
    rateLimiter.reset(params.connection_id);

    auditLogger.log({
      connectionId: params.connection_id,
      engine: adapter.engine,
      operation: 'DISCONNECT',
      executionTimeMs: 0,
      success: true,
    });

    return { content: [{ type: 'text', text: `Disconnected from \`${params.connection_id}\`.` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: list_connections
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'list_connections',
  'List all active database connections',
  {},
  async () => {
    if (adapters.size === 0) {
      return { content: [{ type: 'text', text: 'No active connections. Use the `connect` tool to establish one.' }] };
    }

    let text = '# Active Connections\n\n';
    for (const [id, adapter] of adapters) {
      const alive = await adapter.ping().catch(() => false);
      text += `- **${id}** — ${adapter.engine} ${alive ? '🟢 connected' : '🔴 disconnected'}\n`;
    }
    text += `\n${adapters.size}/${security.maxConnections} connections used.`;

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: query
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'query',
  'Execute a query on a connected database. For SQL databases, use SQL. For MongoDB/Redis/DynamoDB/Firestore/CouchDB, use JSON commands. Always use parameterized queries with the params field for user-provided values.',
  {
    connection_id: z.string().describe('Connection ID'),
    sql: z.string().describe('The query to execute (SQL, Cypher, Flux, or JSON command depending on engine)'),
    params: z.array(z.any()).optional().describe('Parameterized query values (use $1, $2 for Postgres; ?, ? for MySQL; :1, :2 for Oracle; @p0, @p1 for MSSQL)'),
  },
  async ({ connection_id, sql, params }) => {
    const adapter = getAdapter(connection_id);
    checkRateLimit(connection_id);

    // Read-only enforcement
    const connConfig = adapters.get(connection_id);

    // Security validation
    const validation = validateQuery(sql, security, adapter.engine);
    if (!validation.valid) {
      auditLogger.log({
        connectionId: connection_id,
        engine: adapter.engine,
        operation: 'QUERY_BLOCKED',
        query: sql.substring(0, 200),
        executionTimeMs: 0,
        success: false,
        error: validation.reason,
      });
      throw new Error(`🛡️ Query blocked: ${validation.reason}`);
    }

    // NoSQL injection check for JSON-based queries
    const noSqlEngines = ['mongodb', 'dynamodb', 'firestore', 'couchdb', 'elasticsearch'];
    if (security.nosqlInjectionProtection && noSqlEngines.includes(adapter.engine)) {
      const nosqlCheck = detectNoSQLInjection(sql);
      if (!nosqlCheck.safe) {
        throw new Error(`🛡️ Potential NoSQL injection detected: ${nosqlCheck.threats[0]}`);
      }
    }

    try {
      const result = await adapter.query(sql, params);

      auditLogger.log({
        connectionId: connection_id,
        engine: adapter.engine,
        operation: 'QUERY',
        query: sql.substring(0, 500),
        params,
        executionTimeMs: result.executionTimeMs,
        rowsAffected: result.affectedRows ?? result.rowCount,
        success: true,
      });

      // Format output
      let text = '';

      if (result.columns && result.columns.length > 0 && result.rows.length > 0) {
        // Table format for readable output
        text += `| ${result.columns.join(' | ')} |\n`;
        text += `| ${result.columns.map(() => '---').join(' | ')} |\n`;
        for (const row of result.rows) {
          const cells = result.columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          });
          text += `| ${cells.join(' | ')} |\n`;
        }
      } else if (result.rows.length > 0) {
        text += '```json\n' + JSON.stringify(result.rows, null, 2) + '\n```\n';
      }

      text += `\n_${result.rowCount} row(s) returned`;
      if (result.affectedRows !== undefined) text += `, ${result.affectedRows} affected`;
      text += ` in ${result.executionTimeMs}ms_`;
      if (result.truncated) text += `\n⚠️ Results truncated to ${result.rows.length} rows.`;

      return { content: [{ type: 'text', text }] };
    } catch (err: any) {
      auditLogger.log({
        connectionId: connection_id,
        engine: adapter.engine,
        operation: 'QUERY_ERROR',
        query: sql.substring(0, 500),
        executionTimeMs: 0,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: list_tables
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'list_tables',
  'List all tables, collections, indexes, or key patterns in a connected database',
  {
    connection_id: z.string().describe('Connection ID'),
  },
  async ({ connection_id }) => {
    const adapter = getAdapter(connection_id);
    checkRateLimit(connection_id);

    const tables = await adapter.listTables();

    if (tables.length === 0) {
      return { content: [{ type: 'text', text: 'No tables/collections found.' }] };
    }

    let text = `# Tables in \`${connection_id}\` (${adapter.engine})\n\n`;
    text += `| Name | Type | Rows | Size |\n| --- | --- | --- | --- |\n`;
    for (const t of tables) {
      text += `| ${t.schema ? `${t.schema}.` : ''}${t.name} | ${t.type ?? 'table'} | ${t.rowCount ?? '-'} | ${t.sizeBytes ? formatBytes(t.sizeBytes) : '-'} |\n`;
    }
    text += `\n_${tables.length} total_`;

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: describe_table
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'describe_table',
  'Get the schema/structure of a specific table or collection (columns, types, keys, indexes, foreign keys)',
  {
    connection_id: z.string().describe('Connection ID'),
    table: z.string().describe('Table/collection name'),
    schema: z.string().optional().describe('Schema name (default: public for Postgres, dbo for MSSQL)'),
  },
  async ({ connection_id, table, schema }) => {
    const adapter = getAdapter(connection_id);
    checkRateLimit(connection_id);

    const safeName = sanitizeIdentifier(table);
    const info = await adapter.describeTable(safeName, schema);

    let text = `# Schema: \`${info.schema ? `${info.schema}.` : ''}${info.table}\`\n\n`;

    // Columns
    text += `## Columns\n\n`;
    text += `| Name | Type | Nullable | PK | Default |\n| --- | --- | --- | --- | --- |\n`;
    for (const col of info.columns) {
      text += `| ${col.name} | ${col.type}${col.maxLength ? `(${col.maxLength})` : ''} | ${col.nullable ? 'YES' : 'NO'} | ${col.isPrimaryKey ? '🔑' : ''} | ${col.defaultValue ?? '-'} |\n`;
    }

    // Foreign keys
    if (info.foreignKeys && info.foreignKeys.length > 0) {
      text += `\n## Foreign Keys\n\n`;
      for (const fk of info.foreignKeys) {
        text += `- **${fk.name}**: ${fk.columns.join(', ')} → ${fk.referencedTable}(${fk.referencedColumns.join(', ')})\n`;
      }
    }

    // Indexes
    if (info.indexes && info.indexes.length > 0) {
      text += `\n## Indexes\n\n`;
      for (const idx of info.indexes) {
        text += `- **${idx.name}** (${idx.unique ? 'UNIQUE' : 'INDEX'}): ${idx.columns.join(', ')}\n`;
      }
    }

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: list_schemas
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'list_schemas',
  'List available schemas/databases/keyspaces in a connection',
  {
    connection_id: z.string().describe('Connection ID'),
  },
  async ({ connection_id }) => {
    const adapter = getAdapter(connection_id);
    checkRateLimit(connection_id);

    if (!adapter.listSchemas) {
      return { content: [{ type: 'text', text: `Schema listing not supported for ${adapter.engine}.` }] };
    }

    const schemas = await adapter.listSchemas();
    const filtered = schemas.filter(s => isSchemaAllowed(s, security));

    let text = `# Schemas in \`${connection_id}\`\n\n`;
    for (const s of filtered) {
      text += `- ${s}\n`;
    }
    text += `\n_${filtered.length} schemas_`;

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: ping
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'ping',
  'Check if a database connection is alive',
  {
    connection_id: z.string().describe('Connection ID'),
  },
  async ({ connection_id }) => {
    const adapter = getAdapter(connection_id);
    const alive = await adapter.ping();

    return {
      content: [{
        type: 'text',
        text: alive
          ? `🟢 \`${connection_id}\` (${adapter.engine}) is alive.`
          : `🔴 \`${connection_id}\` (${adapter.engine}) is not responding.`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: get_server_info
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'get_server_info',
  'Get version and server information for a connected database',
  {
    connection_id: z.string().describe('Connection ID'),
  },
  async ({ connection_id }) => {
    const adapter = getAdapter(connection_id);
    const version = adapter.getVersion ? await adapter.getVersion() : 'Version info not available';

    return { content: [{ type: 'text', text: `**${connection_id}** (${adapter.engine}): ${version}` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: get_audit_log
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'get_audit_log',
  'Retrieve recent audit log entries for security review',
  {
    limit: z.number().optional().describe('Number of entries to return (default: 50)'),
    connection_id: z.string().optional().describe('Filter by connection ID'),
  },
  async ({ limit, connection_id }) => {
    const entries = auditLogger.getEntries(limit ?? 50, connection_id);

    if (entries.length === 0) {
      return { content: [{ type: 'text', text: 'No audit log entries found.' }] };
    }

    let text = '# Audit Log\n\n';
    text += '| Time | Connection | Operation | Status | Duration | Query |\n';
    text += '| --- | --- | --- | --- | --- | --- |\n';

    for (const entry of entries) {
      text += `| ${entry.timestamp} | ${entry.connectionId} | ${entry.operation} | ${entry.success ? '✅' : '❌'} | ${entry.executionTimeMs}ms | ${(entry.query ?? '-').substring(0, 80)} |\n`;
    }

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL: get_security_config
// ═══════════════════════════════════════════════════════════════════════════

server.tool(
  'get_security_config',
  'View the current security policy settings',
  {},
  async () => {
    const text = `# Security Policy\n\n` +
      `- SQL injection protection: **${security.sqlInjectionProtection ? 'ON' : 'OFF'}**\n` +
      `- NoSQL injection protection: **${security.nosqlInjectionProtection ? 'ON' : 'OFF'}**\n` +
      `- Max query length: **${security.maxQueryLength.toLocaleString()}** chars\n` +
      `- DDL allowed: **${security.allowDDL ? 'YES' : 'NO'}**\n` +
      `- DML allowed: **${security.allowDML ? 'YES' : 'NO'}**\n` +
      `- Rate limit: **${security.rateLimitPerMinute}** queries/min\n` +
      `- Max connections: **${security.maxConnections}**\n` +
      `- Audit logging: **${security.auditLogging ? 'ON' : 'OFF'}**\n` +
      `- Parameterized queries enforced: **${security.enforceParameterizedQueries ? 'YES' : 'NO'}**\n` +
      (security.blockedKeywords.length > 0 ? `- Blocked keywords: ${security.blockedKeywords.join(', ')}\n` : '') +
      (security.blockedSchemas?.length ? `- Blocked schemas: ${security.blockedSchemas.join(', ')}\n` : '') +
      (security.allowedSchemas?.length ? `- Allowed schemas: ${security.allowedSchemas.join(', ')}\n` : '');

    return { content: [{ type: 'text', text }] };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE: connection info
// ═══════════════════════════════════════════════════════════════════════════

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ─── Auto-connect from config ───────────────────────────────────────────────

async function autoConnect(): Promise<void> {
  for (const conn of config.connections) {
    try {
      console.error(`[INIT] Auto-connecting "${conn.id}" (${conn.engine})...`);
      const adapter = await createAdapter(conn);
      await adapter.connect(conn);
      adapters.set(conn.id, adapter);
      console.error(`[INIT] ✅ Connected "${conn.id}"`);
    } catch (err: any) {
      console.error(`[INIT] ❌ Failed to connect "${conn.id}": ${err.message}`);
    }
  }
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.error('[SHUTDOWN] Closing all connections...');
  for (const [id, adapter] of adapters) {
    try {
      await adapter.disconnect();
      console.error(`[SHUTDOWN] Disconnected "${id}"`);
    } catch (err: any) {
      console.error(`[SHUTDOWN] Error disconnecting "${id}": ${err.message}`);
    }
  }
  adapters.clear();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  shutdown();
});

// ─── Start ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  MCP Database Server v1.0.0');
  console.error(`  Supported engines: ${listSupportedEngines().length}`);
  console.error('═══════════════════════════════════════════════════════════');

  // Auto-connect pre-configured databases
  await autoConnect();

  // Start MCP over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Server running on stdio transport');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
