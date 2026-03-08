// ============================================================================
// Utility functions — config loading, environment parsing
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import type { ServerConfig, ConnectionConfig, SecurityPolicy } from '../types/index.js';
import { DEFAULT_SECURITY_POLICY } from '../security/index.js';

/**
 * Load config from file, env vars, or CLI args.
 * Priority: CLI args > env vars > config file > defaults
 */
export function loadConfig(): ServerConfig {
  const configPath = process.env.MCP_DB_CONFIG
    ?? process.argv.find(a => a.startsWith('--config='))?.split('=')[1]
    ?? './config.json';

  let fileConfig: Partial<ServerConfig> = {};

  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      console.error(`[CONFIG] Loaded from ${configPath}`);
    } catch (err) {
      console.error(`[CONFIG] Failed to parse ${configPath}:`, err);
    }
  }

  // Build connections from env vars (MCP_DB_0_ENGINE, MCP_DB_0_HOST, etc.)
  const envConnections = parseEnvConnections();

  const connections = [
    ...(fileConfig.connections ?? []),
    ...envConnections,
  ];

  // Single connection shorthand from env
  if (connections.length === 0 && process.env.MCP_DB_ENGINE) {
    connections.push(parseSingleEnvConnection());
  }

  const security: Partial<SecurityPolicy> = {
    ...fileConfig.security,
  };

  // Env overrides for security
  if (process.env.MCP_DB_READ_ONLY === 'true') {
    security.allowDDL = false;
    security.allowDML = false;
  }
  if (process.env.MCP_DB_ALLOW_DDL === 'true') security.allowDDL = true;
  if (process.env.MCP_DB_RATE_LIMIT) security.rateLimitPerMinute = parseInt(process.env.MCP_DB_RATE_LIMIT, 10);

  return {
    connections,
    security,
    server: {
      name: process.env.MCP_DB_SERVER_NAME ?? fileConfig.server?.name ?? 'mcp-database-server',
      version: fileConfig.server?.version ?? '1.0.0',
      logLevel: (process.env.MCP_DB_LOG_LEVEL as any) ?? fileConfig.server?.logLevel ?? 'info',
    },
  };
}

function parseSingleEnvConnection(): ConnectionConfig {
  return {
    id: process.env.MCP_DB_ID ?? 'default',
    engine: process.env.MCP_DB_ENGINE as any,
    connectionString: process.env.MCP_DB_URL ?? process.env.MCP_DB_CONNECTION_STRING,
    host: process.env.MCP_DB_HOST,
    port: process.env.MCP_DB_PORT ? parseInt(process.env.MCP_DB_PORT, 10) : undefined,
    database: process.env.MCP_DB_DATABASE ?? process.env.MCP_DB_NAME,
    username: process.env.MCP_DB_USER ?? process.env.MCP_DB_USERNAME,
    password: process.env.MCP_DB_PASSWORD,
    readOnly: process.env.MCP_DB_READ_ONLY === 'true',
    ssl: process.env.MCP_DB_SSL === 'true' ? {
      enabled: true,
      rejectUnauthorized: process.env.MCP_DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    } : undefined,
    region: process.env.MCP_DB_REGION ?? process.env.AWS_REGION,
    projectId: process.env.MCP_DB_PROJECT_ID ?? process.env.GCLOUD_PROJECT,
    queryTimeout: process.env.MCP_DB_QUERY_TIMEOUT ? parseInt(process.env.MCP_DB_QUERY_TIMEOUT, 10) : undefined,
    maxRows: process.env.MCP_DB_MAX_ROWS ? parseInt(process.env.MCP_DB_MAX_ROWS, 10) : undefined,
  };
}

function parseEnvConnections(): ConnectionConfig[] {
  const connections: ConnectionConfig[] = [];
  for (let i = 0; i < 20; i++) {
    const prefix = `MCP_DB_${i}_`;
    const engine = process.env[`${prefix}ENGINE`];
    if (!engine) continue;

    connections.push({
      id: process.env[`${prefix}ID`] ?? `db-${i}`,
      engine: engine as any,
      connectionString: process.env[`${prefix}URL`],
      host: process.env[`${prefix}HOST`],
      port: process.env[`${prefix}PORT`] ? parseInt(process.env[`${prefix}PORT`]!, 10) : undefined,
      database: process.env[`${prefix}DATABASE`],
      username: process.env[`${prefix}USER`],
      password: process.env[`${prefix}PASSWORD`],
      readOnly: process.env[`${prefix}READ_ONLY`] === 'true',
      region: process.env[`${prefix}REGION`],
      projectId: process.env[`${prefix}PROJECT_ID`],
    });
  }
  return connections;
}

export function mergeSecurityPolicy(partial: Partial<SecurityPolicy>): SecurityPolicy {
  return { ...DEFAULT_SECURITY_POLICY, ...partial };
}
