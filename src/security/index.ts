// ============================================================================
// Security Layer — Injection protection, rate limiting, audit, sanitization
// ============================================================================

import type { SecurityPolicy, AuditEntry, DatabaseEngine } from '../types/index.js';

// ─── Default Security Policy ────────────────────────────────────────────────

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  sqlInjectionProtection: true,
  nosqlInjectionProtection: true,
  maxQueryLength: 50_000,
  blockedKeywords: [],
  allowedSchemas: undefined,
  blockedSchemas: ['information_schema', 'pg_catalog', 'sys', 'mysql', 'performance_schema'],
  allowDDL: false,
  allowDML: true,
  auditLogging: true,
  rateLimitPerMinute: 120,
  maxConnections: 20,
  enforceParameterizedQueries: false,
};

// ─── SQL Injection Detection ────────────────────────────────────────────────

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(UNION)\b\s+\b(ALL\s+)?SELECT\b)/i,
  /(;\s*(DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\s)/i,
  /(\b(EXEC|EXECUTE)\s+(IMMEDIATE\s+)?['"])/i,
  /(\/\*[\s\S]*?\*\/)/,                               // block comments used for obfuscation
  /(--\s*$)/m,                                         // trailing line comments
  /(\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)/i,
  /(\b(BENCHMARK|SLEEP|WAITFOR\s+DELAY|PG_SLEEP)\b)/i, // timing attacks
  /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\(\s*\d+\s*\))/i, // char encoding bypass
  /(0x[0-9a-fA-F]+)/,                                  // hex encoding
  /(\bCONVERT\s*\()/i,
  /(\bCAST\s*\(.*?\bAS\b)/i,
];

const NOSQL_INJECTION_PATTERNS: RegExp[] = [
  /\$where\b/,
  /\$gt\b|\$gte\b|\$lt\b|\$lte\b|\$ne\b|\$nin\b|\$regex\b/,
  /\$or\b|\$and\b|\$not\b|\$nor\b/,
  /\.\$\w+/,
  /function\s*\(/,
  /this\.\w+/,
  /db\.\w+\.\w+/,
];

export function detectSQLInjection(query: string): { safe: boolean; threats: string[] } {
  const threats: string[] = [];

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      threats.push(`Suspicious pattern detected: ${pattern.source.substring(0, 60)}`);
    }
  }

  // Check for stacked queries (multiple statements)
  const statementCount = query.split(/;\s*/).filter(s => s.trim().length > 0).length;
  if (statementCount > 1) {
    threats.push('Multiple statements detected (possible stacked query injection)');
  }

  return { safe: threats.length === 0, threats };
}

export function detectNoSQLInjection(input: unknown): { safe: boolean; threats: string[] } {
  const threats: string[] = [];
  const serialized = typeof input === 'string' ? input : JSON.stringify(input);

  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(serialized)) {
      threats.push(`NoSQL injection pattern detected: ${pattern.source.substring(0, 60)}`);
    }
  }

  return { safe: threats.length === 0, threats };
}

// ─── Query Validation ───────────────────────────────────────────────────────

const DDL_KEYWORDS = /\b(CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;
const DML_KEYWORDS = /\b(INSERT|UPDATE|DELETE|MERGE|REPLACE|UPSERT)\b/i;

export function validateQuery(
  query: string,
  policy: SecurityPolicy,
  engine: DatabaseEngine,
): { valid: boolean; reason?: string } {
  // Length check
  if (query.length > policy.maxQueryLength) {
    return { valid: false, reason: `Query exceeds maximum length of ${policy.maxQueryLength} characters` };
  }

  // Blocked keywords
  for (const keyword of policy.blockedKeywords) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    if (regex.test(query)) {
      return { valid: false, reason: `Query contains blocked keyword: ${keyword}` };
    }
  }

  // DDL check
  if (!policy.allowDDL && DDL_KEYWORDS.test(query)) {
    return { valid: false, reason: 'DDL statements are not allowed by security policy' };
  }

  // DML check
  if (!policy.allowDML && DML_KEYWORDS.test(query)) {
    return { valid: false, reason: 'DML statements are not allowed by security policy' };
  }

  // SQL injection detection (for SQL-based engines)
  const sqlEngines: DatabaseEngine[] = [
    'postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql', 'oracle',
    'cockroachdb', 'clickhouse', 'neon', 'planetscale', 'tidb', 'singlestore',
  ];

  if (policy.sqlInjectionProtection && sqlEngines.includes(engine)) {
    const result = detectSQLInjection(query);
    if (!result.safe) {
      return { valid: false, reason: `Potential SQL injection: ${result.threats[0]}` };
    }
  }

  return { valid: true };
}

// ─── Input Sanitization ─────────────────────────────────────────────────────

export function sanitizeIdentifier(identifier: string): string {
  // Remove anything that isn't alphanumeric, underscore, dot, or dash
  return identifier.replace(/[^a-zA-Z0-9_.\-]/g, '');
}

export function sanitizeConnectionString(connStr: string): string {
  // Mask passwords in connection strings for logging
  return connStr
    .replace(/:([^@/:]+)@/g, ':****@')
    .replace(/password=([^;&\s]+)/gi, 'password=****')
    .replace(/pwd=([^;&\s]+)/gi, 'pwd=****');
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, RateBucket>();
  private maxPerMinute: number;

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  /** Returns true if the request is allowed */
  check(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (bucket.count >= this.maxPerMinute) {
      return false;
    }

    bucket.count++;
    return true;
  }

  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket || Date.now() >= bucket.resetAt) return this.maxPerMinute;
    return Math.max(0, this.maxPerMinute - bucket.count);
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

// ─── Audit Logger ───────────────────────────────────────────────────────────

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries: number;
  private enabled: boolean;

  constructor(enabled = true, maxEntries = 10_000) {
    this.enabled = enabled;
    this.maxEntries = maxEntries;
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    if (!this.enabled) return;

    const full: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      // Redact sensitive values from params
      params: entry.params?.map(p =>
        typeof p === 'string' && p.length > 100 ? `${p.substring(0, 20)}...[redacted]` : p
      ),
    };

    this.entries.push(full);

    // Circular buffer: drop oldest entries when full
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-Math.floor(this.maxEntries * 0.8));
    }

    // Also write to stderr for stdio-based MCP servers
    console.error(
      `[AUDIT] ${full.timestamp} | ${full.connectionId} | ${full.operation} | ` +
      `${full.success ? 'OK' : 'FAIL'} | ${full.executionTimeMs}ms` +
      (full.query ? ` | ${full.query.substring(0, 120)}` : '')
    );
  }

  getEntries(limit = 100, connectionId?: string): AuditEntry[] {
    let filtered = this.entries;
    if (connectionId) {
      filtered = filtered.filter(e => e.connectionId === connectionId);
    }
    return filtered.slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }
}

// ─── Connection Credential Encryption Helper ────────────────────────────────

export function maskSensitiveConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'accessKey', 'secretKey'];
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      masked[key] = '****';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveConfig(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

// ─── Schema Access Control ──────────────────────────────────────────────────

export function isSchemaAllowed(
  schema: string,
  policy: SecurityPolicy,
): boolean {
  if (policy.allowedSchemas && policy.allowedSchemas.length > 0) {
    return policy.allowedSchemas.includes(schema);
  }
  if (policy.blockedSchemas && policy.blockedSchemas.length > 0) {
    return !policy.blockedSchemas.includes(schema);
  }
  return true;
}

// ─── Utils ──────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
