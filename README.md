# 🗄️ mcp-database-server

### Connect **any LLM** to **22 databases** in seconds.

> One MCP server. Every database you'll ever need. Secure by default. Zero boilerplate.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — the open standard that lets AI assistants talk to your databases safely.

```
┌──────────────┐      ┌─────────────────────────┐      ┌──────────────────┐
│              │      │                         │      │   PostgreSQL     │
│   Claude /   │◄────►│   mcp-database-server   │◄────►│   MySQL          │
│   Any LLM    │ MCP  │                         │      │   MongoDB        │
│              │      │   • Security Layer       │      │   Redis          │
│              │      │   • Rate Limiting        │      │   ... 18 more    │
└──────────────┘      │   • Audit Logging        │      └──────────────────┘
                      └─────────────────────────┘
```

---

## 📑 Table of Contents

- [What Does This Do?](#-what-does-this-do)
- [Supported Databases](#-supported-databases-22)
- [Installation](#-installation)
- [Quick Start (5 minutes)](#-quick-start-5-minutes)
- [Setup with Claude Desktop](#️-setup-with-claude-desktop)
- [Setup with Claude Code](#-setup-with-claude-code)
- [Setup with Config File](#-setup-with-config-file)
- [All MCP Tools Reference](#-all-mcp-tools-reference)
- **Database Guides** (click any to jump):
  - [PostgreSQL](#-postgresql)
  - [MySQL](#-mysql)
  - [MariaDB](#-mariadb)
  - [SQLite](#-sqlite)
  - [Microsoft SQL Server](#-microsoft-sql-server-mssql)
  - [Oracle](#-oracle)
  - [CockroachDB](#-cockroachdb)
  - [Neon (Serverless Postgres)](#-neon-serverless-postgres)
  - [Supabase](#-supabase)
  - [PlanetScale](#-planetscale)
  - [TiDB](#-tidb)
  - [SingleStore](#-singlestore)
  - [MongoDB](#-mongodb)
  - [Redis](#-redis)
  - [Cassandra / ScyllaDB](#-cassandra--scylladb)
  - [ClickHouse](#-clickhouse)
  - [Neo4j](#-neo4j)
  - [DynamoDB](#-dynamodb)
  - [Elasticsearch / OpenSearch](#-elasticsearch--opensearch)
  - [CouchDB](#-couchdb)
  - [InfluxDB](#-influxdb)
  - [Firestore](#-firestore)
- [Security](#-security)
- [Environment Variables Reference](#-environment-variables-reference)
- [Troubleshooting](#-troubleshooting)
- [Publishing to NPM](#-publishing-to-npm)
- [Architecture](#-architecture)
- [License](#-license)

---

## 🤔 What Does This Do?

Imagine you could say to Claude:

> *"Show me all users who signed up last week"*

...and Claude actually queries your PostgreSQL database, gets the results, and shows you the data. That's what this does.

**Without this tool**, Claude has no way to talk to your databases.
**With this tool**, Claude can:

- ✅ Run queries on any of your databases
- ✅ Explore tables and schemas
- ✅ Understand your data model (columns, types, foreign keys)
- ✅ Work across multiple databases at once
- ✅ Do it all securely (read-only mode, injection protection, rate limits, audit logs)

---

## 🎯 Supported Databases (22)

| # | Database | Category | NPM Driver to Install |
|---|----------|----------|-----------------------|
| 1 | **PostgreSQL** | Relational | `npm install pg` |
| 2 | **MySQL** | Relational | `npm install mysql2` |
| 3 | **MariaDB** | Relational | `npm install mysql2` |
| 4 | **SQLite** | Relational | `npm install better-sqlite3` |
| 5 | **MS SQL Server** | Relational | `npm install tedious` |
| 6 | **Oracle** | Relational | `npm install oracledb` |
| 7 | **CockroachDB** | NewSQL | `npm install pg` |
| 8 | **Neon** | Serverless Postgres | `npm install pg` |
| 9 | **Supabase** | BaaS (Postgres) | `npm install pg` |
| 10 | **PlanetScale** | Serverless MySQL | `npm install mysql2` |
| 11 | **TiDB** | NewSQL | `npm install mysql2` |
| 12 | **SingleStore** | NewSQL | `npm install mysql2` |
| 13 | **MongoDB** | Document | `npm install mongodb` |
| 14 | **Redis** | Key-Value | `npm install redis` |
| 15 | **Cassandra** / ScyllaDB | Wide Column | `npm install cassandra-driver` |
| 16 | **ClickHouse** | Analytics | `npm install @clickhouse/client` |
| 17 | **Neo4j** | Graph | `npm install neo4j-driver` |
| 18 | **DynamoDB** | AWS Key-Value | `npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb` |
| 19 | **Elasticsearch** / OpenSearch | Search | `npm install @elastic/elasticsearch` |
| 20 | **CouchDB** | Document | `npm install nano` |
| 21 | **InfluxDB** | Time Series | `npm install @influxdata/influxdb-client` |
| 22 | **Firestore** | Google Cloud Document | `npm install firebase-admin` |

> **Important:** You only install drivers for databases you actually use. Don't install all of them!

---

## 📦 Installation

### Step 1: Install the server

```bash
npm install -g mcp-database-server
```

### Step 2: Install ONLY the database driver(s) you need

Using PostgreSQL? Install `pg`:
```bash
npm install -g pg
```

Using MongoDB? Install `mongodb`:
```bash
npm install -g mongodb
```

Using multiple databases? Install multiple:
```bash
npm install -g pg mongodb redis
```

That's it. You're ready.

---

## 🚀 Quick Start (5 minutes)

The fastest way to try it out:

### Option A: Environment Variables (simplest)

```bash
# Set your database details
export MCP_DB_ENGINE=postgresql
export MCP_DB_HOST=localhost
export MCP_DB_PORT=5432
export MCP_DB_DATABASE=myapp
export MCP_DB_USER=postgres
export MCP_DB_PASSWORD=mypassword

# Run the server
npx mcp-database-server
```

### Option B: Connection String (one line)

```bash
export MCP_DB_ENGINE=postgresql
export MCP_DB_URL="postgresql://postgres:mypassword@localhost:5432/myapp"

npx mcp-database-server
```

### Option C: Config File (most flexible)

```bash
# Copy the example
cp config.example.json config.json

# Edit it with your details
nano config.json

# Run it
MCP_DB_CONFIG=./config.json npx mcp-database-server
```

---

## 🖥️ Setup with Claude Desktop

Claude Desktop uses a config file at:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Open that file and add:

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "postgresql",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "5432",
        "MCP_DB_DATABASE": "myapp",
        "MCP_DB_USER": "postgres",
        "MCP_DB_PASSWORD": "secret"
      }
    }
  }
}
```

**Save the file, restart Claude Desktop.** That's it.

Now you can open Claude and say:
> *"Show me all tables in my database"*

---

## 💻 Setup with Claude Code

```bash
# Simple: one database
claude mcp add database -- npx -y mcp-database-server

# With config file
claude mcp add database -- env MCP_DB_CONFIG=./config.json npx -y mcp-database-server
```

---

## 📁 Setup with Config File

Create a file called `config.json`:

```json
{
  "server": {
    "name": "my-databases",
    "logLevel": "info"
  },

  "connections": [
    {
      "id": "my-postgres",
      "engine": "postgresql",
      "host": "localhost",
      "port": 5432,
      "database": "myapp",
      "username": "postgres",
      "password": "secret",
      "readOnly": true
    }
  ],

  "security": {
    "sqlInjectionProtection": true,
    "allowDDL": false,
    "allowDML": true,
    "rateLimitPerMinute": 120,
    "auditLogging": true
  }
}
```

### Multiple databases in one config:

```json
{
  "connections": [
    {
      "id": "app-db",
      "engine": "postgresql",
      "connectionString": "postgresql://user:pass@host:5432/myapp",
      "readOnly": true
    },
    {
      "id": "cache",
      "engine": "redis",
      "host": "localhost",
      "port": 6379
    },
    {
      "id": "analytics",
      "engine": "clickhouse",
      "host": "localhost",
      "port": 8123,
      "database": "analytics",
      "readOnly": true
    }
  ],
  "security": {
    "allowDDL": false,
    "rateLimitPerMinute": 60
  }
}
```

---

## 🛠 All MCP Tools Reference

Once the server is running, these tools are available to the LLM:

### `list_supported_databases`
Lists all 22 database engines with categories and aliases.

**Example prompt to Claude:**
> *"What databases can you connect to?"*

---

### `connect`
Opens a new connection to a database.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `connection_id` | ✅ | A name you pick, e.g. `"my-postgres"` |
| `engine` | ✅ | Database type, e.g. `"postgresql"` |
| `connection_string` | | Full URI, e.g. `"postgresql://user:pass@host:5432/db"` |
| `host` | | Hostname or IP |
| `port` | | Port number |
| `database` | | Database name |
| `username` | | Username |
| `password` | | Password |
| `ssl` | | `true` to enable SSL |
| `read_only` | | `true` to block all writes |
| `region` | | AWS region (DynamoDB only) |
| `project_id` | | GCP project ID (Firestore only) |

**Example prompt to Claude:**
> *"Connect to my PostgreSQL database at localhost, port 5432, database called myapp, user postgres, password secret"*

---

### `disconnect`
Closes a connection.

**Example prompt:**
> *"Disconnect from my-postgres"*

---

### `list_connections`
Shows all open connections and their health status (🟢 or 🔴).

**Example prompt:**
> *"Show me all active database connections"*

---

### `query`
Executes a query. This is the main tool. Works differently for each database type — see the database-specific guides below.

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `connection_id` | ✅ | Which connection to query |
| `sql` | ✅ | The query (SQL, Cypher, JSON, or Flux) |
| `params` | | Array of parameter values for safe queries |

**Example prompt:**
> *"Run this query on my-postgres: SELECT name, email FROM users WHERE created_at > '2024-01-01'"*

---

### `list_tables`
Lists all tables, collections, indexes, or key patterns.

**Example prompt:**
> *"What tables are in my-postgres?"*

---

### `describe_table`
Shows the full schema of a table: column names, types, primary keys, foreign keys, indexes.

**Example prompt:**
> *"Describe the users table in my-postgres"*

---

### `list_schemas`
Lists available schemas, databases, or keyspaces.

**Example prompt:**
> *"What schemas are available in my-postgres?"*

---

### `ping`
Health check — tells you if a connection is alive.

**Example prompt:**
> *"Is my-postgres still connected?"*

---

### `get_server_info`
Gets the database version info.

**Example prompt:**
> *"What version of PostgreSQL is my-postgres running?"*

---

### `get_audit_log`
Shows recent query history for security review.

**Example prompt:**
> *"Show me the last 20 queries that were run"*

---

### `get_security_config`
Displays the current security policy settings.

**Example prompt:**
> *"What security settings are active?"*

---

---

# 📘 Database Guides

Each guide below shows you **exactly** how to set up and use each database, with copy-paste examples.

---

---

## 🐘 PostgreSQL

**What it is:** The world's most popular open-source relational database.

### Install the driver

```bash
npm install -g pg
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "postgresql",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "5432",
        "MCP_DB_DATABASE": "myapp",
        "MCP_DB_USER": "postgres",
        "MCP_DB_PASSWORD": "secret",
        "MCP_DB_READ_ONLY": "true",
        "MCP_DB_SSL": "false"
      }
    }
  }
}
```

### Using a connection string instead

```json
{
  "env": {
    "MCP_DB_ENGINE": "postgresql",
    "MCP_DB_URL": "postgresql://postgres:secret@localhost:5432/myapp?sslmode=require"
  }
}
```

### Config file version

```json
{
  "connections": [{
    "id": "my-postgres",
    "engine": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "username": "postgres",
    "password": "secret",
    "readOnly": true,
    "ssl": { "enabled": false },
    "pool": { "min": 1, "max": 10 },
    "queryTimeout": 30000,
    "maxRows": 1000
  }]
}
```

### Query examples

**Simple SELECT:**
```sql
SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 10
```

**With parameters (safe — prevents SQL injection):**
```
sql:    "SELECT * FROM users WHERE age > $1 AND city = $2"
params: [25, "London"]
```

**JOINs:**
```sql
SELECT u.name, o.total, o.created_at
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.total > 100
ORDER BY o.created_at DESC
LIMIT 20
```

**Aggregation:**
```sql
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS signups,
  AVG(age) AS avg_age
FROM users
GROUP BY month
ORDER BY month DESC
```

**INSERT (only works if readOnly is false):**
```
sql:    "INSERT INTO users (name, email, age) VALUES ($1, $2, $3)"
params: ["Alice", "alice@example.com", 30]
```

**UPDATE:**
```
sql:    "UPDATE users SET active = false WHERE last_login < $1"
params: ["2024-01-01"]
```

### Example prompts to Claude

> *"Show me all users who signed up this month"*
>
> *"What are the top 10 products by revenue?"*
>
> *"Find all orders that haven't been shipped yet"*
>
> *"How many users signed up each week for the last 3 months?"*
>
> *"Show me the schema of the orders table"*

---

## 🐬 MySQL

**What it is:** The world's most popular open-source relational database (used by Facebook, Twitter, YouTube).

### Install the driver

```bash
npm install -g mysql2
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "mysql",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "3306",
        "MCP_DB_DATABASE": "myapp",
        "MCP_DB_USER": "root",
        "MCP_DB_PASSWORD": "secret",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### Connection string version

```json
{
  "env": {
    "MCP_DB_ENGINE": "mysql",
    "MCP_DB_URL": "mysql://root:secret@localhost:3306/myapp"
  }
}
```

### Query examples

**Simple SELECT:**
```sql
SELECT * FROM products WHERE price > 50 ORDER BY price DESC LIMIT 10
```

**With parameters (use `?` placeholders):**
```
sql:    "SELECT * FROM users WHERE country = ? AND age >= ?"
params: ["India", 18]
```

**GROUP BY:**
```sql
SELECT category, COUNT(*) AS product_count, AVG(price) AS avg_price
FROM products
GROUP BY category
ORDER BY product_count DESC
```

### Example prompts to Claude

> *"What are the most expensive products in each category?"*
>
> *"Show me all customers who haven't ordered in 6 months"*
>
> *"Count how many orders we got per day this week"*

---

## 🦭 MariaDB

**What it is:** A drop-in replacement for MySQL, created by MySQL's original developers. Uses the exact same driver and syntax as MySQL.

### Install the driver

```bash
npm install -g mysql2
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "mariadb",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "3306",
        "MCP_DB_DATABASE": "myapp",
        "MCP_DB_USER": "root",
        "MCP_DB_PASSWORD": "secret"
      }
    }
  }
}
```

### Query examples

Same as MySQL! Use `?` for parameters:

```
sql:    "SELECT * FROM orders WHERE status = ? AND total > ?"
params: ["pending", 100]
```

---

## 📁 SQLite

**What it is:** A file-based database. No server needed. Perfect for local apps, prototyping, or embedded databases.

### Install the driver

```bash
npm install -g better-sqlite3
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "sqlite",
        "MCP_DB_DATABASE": "/path/to/your/database.db",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### Using in-memory SQLite (for testing)

```json
{
  "env": {
    "MCP_DB_ENGINE": "sqlite",
    "MCP_DB_DATABASE": ":memory:"
  }
}
```

### Query examples

**Standard SQL works:**
```sql
SELECT * FROM todos WHERE completed = 0 ORDER BY created_at DESC
```

**With parameters (use positional `?`):**
```
sql:    "SELECT * FROM notes WHERE tag = ? AND archived = ?"
params: ["work", 0]
```

**Check table info:**
```sql
PRAGMA table_info('users')
```

### Example prompts to Claude

> *"Open my local database at /Users/me/app/data.db and show me all tables"*
>
> *"How many records are in the notes table?"*

---

## 🏢 Microsoft SQL Server (MSSQL)

**What it is:** Microsoft's enterprise relational database.

### Install the driver

```bash
npm install -g tedious
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "mssql",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "1433",
        "MCP_DB_DATABASE": "MyDatabase",
        "MCP_DB_USER": "sa",
        "MCP_DB_PASSWORD": "YourStrong!Passw0rd",
        "MCP_DB_SSL": "true"
      }
    }
  }
}
```

### Query examples

**Note:** MSSQL uses `@p0`, `@p1`, `@p2` for parameter placeholders.

```
sql:    "SELECT TOP 10 * FROM Employees WHERE Department = @p0 AND Salary > @p1"
params: ["Engineering", 80000]
```

**Pagination with OFFSET/FETCH:**
```sql
SELECT * FROM Products
ORDER BY ProductName
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY
```

### Example prompts to Claude

> *"Show me all employees in the Engineering department"*
>
> *"What's the average salary by department?"*

---

## 🔮 Oracle

**What it is:** Oracle's enterprise relational database. Used by banks, governments, and Fortune 500 companies.

### Install the driver

```bash
npm install -g oracledb
```

> **Note:** Oracle Instant Client must also be installed on your system. See [Oracle's install guide](https://oracle.github.io/node-oracledb/INSTALL.html).

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "oracle",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "1521",
        "MCP_DB_DATABASE": "ORCL",
        "MCP_DB_USER": "hr",
        "MCP_DB_PASSWORD": "secret"
      }
    }
  }
}
```

### Query examples

**Note:** Oracle uses `:1`, `:2`, `:3` for parameter placeholders.

```
sql:    "SELECT * FROM employees WHERE department_id = :1 AND salary > :2"
params: [60, 5000]
```

---

## 🪳 CockroachDB

**What it is:** A distributed SQL database built for global scale. Wire-compatible with PostgreSQL.

### Install the driver

```bash
npm install -g pg
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "cockroachdb",
        "MCP_DB_URL": "postgresql://user:pass@localhost:26257/defaultdb?sslmode=verify-full",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### Query examples

Uses standard PostgreSQL syntax. Same `$1`, `$2` parameters:

```
sql:    "SELECT * FROM accounts WHERE balance > $1"
params: [1000]
```

---

## ⚡ Neon (Serverless Postgres)

**What it is:** Serverless PostgreSQL. Scales to zero. Pay per query.

### Install the driver

```bash
npm install -g pg
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "neon",
        "MCP_DB_URL": "postgresql://user:pass@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
        "MCP_DB_SSL": "true",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

> **Where to find your connection string:** Neon Console → Your Project → Connection Details → Copy the connection string.

### Query examples

Standard PostgreSQL syntax. Same as PostgreSQL above.

---

## 🟢 Supabase

**What it is:** An open-source Firebase alternative built on PostgreSQL.

### Install the driver

```bash
npm install -g pg
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "supabase",
        "MCP_DB_URL": "postgresql://postgres.xxxxxxxxxxxx:YOUR-PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        "MCP_DB_SSL": "true",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

> **Where to find your connection string:** Supabase Dashboard → Settings → Database → Connection string → URI.

### Query examples

Standard PostgreSQL syntax. Same as PostgreSQL above.

---

## 🪐 PlanetScale

**What it is:** Serverless MySQL platform by Vitess.

### Install the driver

```bash
npm install -g mysql2
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "planetscale",
        "MCP_DB_HOST": "aws.connect.psdb.cloud",
        "MCP_DB_USER": "xxxxxxxxxx",
        "MCP_DB_PASSWORD": "pscale_pw_xxxxxxxx",
        "MCP_DB_DATABASE": "mydb",
        "MCP_DB_SSL": "true",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### Query examples

Standard MySQL syntax. Use `?` for parameters:

```
sql:    "SELECT * FROM orders WHERE status = ?"
params: ["shipped"]
```

---

## ⚡ TiDB

**What it is:** An open-source, distributed SQL database compatible with MySQL.

### Install the driver

```bash
npm install -g mysql2
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "tidb",
        "MCP_DB_HOST": "gateway01.us-east-1.prod.aws.tidbcloud.com",
        "MCP_DB_PORT": "4000",
        "MCP_DB_DATABASE": "mydb",
        "MCP_DB_USER": "root",
        "MCP_DB_PASSWORD": "secret",
        "MCP_DB_SSL": "true"
      }
    }
  }
}
```

### Query examples

Standard MySQL syntax. Same as MySQL above.

---

## ⚡ SingleStore

**What it is:** A distributed SQL database designed for real-time analytics. MySQL-compatible.

### Install the driver

```bash
npm install -g mysql2
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "singlestore",
        "MCP_DB_HOST": "svc-xxxxxxxxxx.svc.singlestore.com",
        "MCP_DB_PORT": "3306",
        "MCP_DB_DATABASE": "mydb",
        "MCP_DB_USER": "admin",
        "MCP_DB_PASSWORD": "secret",
        "MCP_DB_SSL": "true"
      }
    }
  }
}
```

---

## 🍃 MongoDB

**What it is:** The most popular document database. Stores data as flexible JSON-like documents instead of rows and columns.

### Install the driver

```bash
npm install -g mongodb
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "mongodb",
        "MCP_DB_URL": "mongodb://localhost:27017/myapp",
        "MCP_DB_DATABASE": "myapp",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### MongoDB Atlas (cloud)

```json
{
  "env": {
    "MCP_DB_ENGINE": "mongodb",
    "MCP_DB_URL": "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/myapp?retryWrites=true&w=majority",
    "MCP_DB_DATABASE": "myapp"
  }
}
```

### How MongoDB queries work

MongoDB does NOT use SQL. Instead, you pass a **JSON command**. Here's the format:

```json
{
  "collection": "name_of_collection",
  "operation": "find|findOne|aggregate|insertOne|...",
  "filter": {},
  "projection": {},
  "sort": {},
  "limit": 100
}
```

### Query examples

**Find all documents in a collection:**
```json
{
  "collection": "users",
  "operation": "find",
  "filter": {},
  "limit": 50
}
```

**Find with filters:**
```json
{
  "collection": "users",
  "operation": "find",
  "filter": { "age": { "$gt": 25 }, "city": "Mumbai" },
  "projection": { "name": 1, "email": 1 },
  "sort": { "name": 1 },
  "limit": 20
}
```

**Find one document:**
```json
{
  "collection": "users",
  "operation": "findOne",
  "filter": { "email": "alice@example.com" }
}
```

**Count documents:**
```json
{
  "collection": "orders",
  "operation": "countDocuments",
  "filter": { "status": "pending" }
}
```

**Aggregation pipeline:**
```json
{
  "collection": "orders",
  "operation": "aggregate",
  "pipeline": [
    { "$match": { "status": "completed" } },
    { "$group": { "_id": "$product", "total": { "$sum": "$amount" } } },
    { "$sort": { "total": -1 } },
    { "$limit": 10 }
  ]
}
```

**Get distinct values:**
```json
{
  "collection": "users",
  "operation": "distinct",
  "field": "country"
}
```

**Insert one document (only if readOnly is false):**
```json
{
  "collection": "users",
  "operation": "insertOne",
  "document": { "name": "Alice", "email": "alice@example.com", "age": 30 }
}
```

**Insert many documents:**
```json
{
  "collection": "products",
  "operation": "insertMany",
  "documents": [
    { "name": "Widget A", "price": 9.99 },
    { "name": "Widget B", "price": 19.99 }
  ]
}
```

**Update one document:**
```json
{
  "collection": "users",
  "operation": "updateOne",
  "filter": { "email": "alice@example.com" },
  "update": { "$set": { "age": 31, "updatedAt": "2024-06-01" } }
}
```

**Update many documents:**
```json
{
  "collection": "users",
  "operation": "updateMany",
  "filter": { "active": false },
  "update": { "$set": { "archived": true } }
}
```

**Delete one document:**
```json
{
  "collection": "users",
  "operation": "deleteOne",
  "filter": { "email": "bob@example.com" }
}
```

**Delete many documents:**
```json
{
  "collection": "logs",
  "operation": "deleteMany",
  "filter": { "createdAt": { "$lt": "2024-01-01" } }
}
```

### Example prompts to Claude

> *"Show me all users from India who are over 25"*
>
> *"What are the top 10 products by total sales?"*
>
> *"Count how many pending orders we have"*
>
> *"List all unique countries in our user database"*

---

## 🔴 Redis

**What it is:** An in-memory key-value store. Blazing fast. Used for caching, sessions, queues, and real-time data.

### Install the driver

```bash
npm install -g redis
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "redis",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "6379"
      }
    }
  }
}
```

### With password and SSL (e.g., Redis Cloud)

```json
{
  "env": {
    "MCP_DB_ENGINE": "redis",
    "MCP_DB_URL": "rediss://default:your_password@redis-12345.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345",
    "MCP_DB_SSL": "true"
  }
}
```

### How Redis queries work

Redis uses **commands**, not SQL. You can type them as plain text or JSON.

### Query examples (plain text)

**Get a value:**
```
GET user:1001
```

**Set a value:**
```
SET user:1001 "Alice"
```

**Set with expiry (60 seconds):**
```
SET session:abc123 "token_data" EX 60
```

**Get a hash (like an object):**
```
HGETALL user:1001
```

**Set hash fields:**
```
HSET user:1001 name "Alice" age "30" city "Mumbai"
```

**List all keys matching a pattern:**
```
KEYS user:*
```

**Delete a key:**
```
DEL user:1001
```

**Get list items:**
```
LRANGE myqueue 0 -1
```

**Increment a counter:**
```
INCR page:views:homepage
```

**Check key type:**
```
TYPE user:1001
```

**Get TTL (time to live):**
```
TTL session:abc123
```

### Query examples (JSON format)

```json
{ "command": "HGETALL", "args": ["user:1001"] }
```

```json
{ "command": "SET", "args": ["greeting", "hello world"] }
```

### Example prompts to Claude

> *"What's stored in the key user:1001?"*
>
> *"Show me all session keys"*
>
> *"How many page views does the homepage have?"*

---

## 📊 Cassandra / ScyllaDB

**What it is:** A wide-column distributed database designed for massive scale. Used by Apple, Netflix, Discord.

### Install the driver

```bash
npm install -g cassandra-driver
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "cassandra",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "9042",
        "MCP_DB_DATABASE": "my_keyspace",
        "MCP_DB_USER": "cassandra",
        "MCP_DB_PASSWORD": "cassandra"
      }
    }
  }
}
```

### Config file with datacenter

```json
{
  "connections": [{
    "id": "my-cassandra",
    "engine": "cassandra",
    "host": "node1.example.com,node2.example.com",
    "port": 9042,
    "database": "my_keyspace",
    "username": "admin",
    "password": "secret",
    "options": { "datacenter": "us-east-1" }
  }]
}
```

### Query examples

Cassandra uses CQL (Cassandra Query Language), which looks like SQL:

```
sql:    "SELECT * FROM users WHERE user_id = ? LIMIT 10"
params: ["user-abc-123"]
```

```
sql:    "SELECT * FROM events WHERE partition_key = ? AND event_time > ? ALLOW FILTERING"
params: ["sensor-01", "2024-06-01T00:00:00Z"]
```

> ⚠️ **Important:** Cassandra requires you to query by partition key. You can't do arbitrary WHERE clauses like in PostgreSQL.

---

## ⚡ ClickHouse

**What it is:** A column-oriented database for blazing-fast analytics. Can process billions of rows per second.

### Install the driver

```bash
npm install -g @clickhouse/client
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "clickhouse",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "8123",
        "MCP_DB_DATABASE": "analytics",
        "MCP_DB_USER": "default",
        "MCP_DB_PASSWORD": "",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### ClickHouse Cloud

```json
{
  "env": {
    "MCP_DB_ENGINE": "clickhouse",
    "MCP_DB_URL": "https://xxxx.clickhouse.cloud:8443",
    "MCP_DB_USER": "default",
    "MCP_DB_PASSWORD": "your-password",
    "MCP_DB_DATABASE": "default",
    "MCP_DB_SSL": "true"
  }
}
```

### Query examples

Standard SQL works, with ClickHouse-specific functions:

```sql
SELECT
  toDate(timestamp) AS day,
  count() AS events,
  uniq(user_id) AS unique_users
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day DESC
```

```sql
SELECT
  country,
  count() AS users,
  avg(session_duration) AS avg_duration
FROM user_sessions
GROUP BY country
ORDER BY users DESC
LIMIT 20
```

### Example prompts to Claude

> *"How many events did we get per day this week?"*
>
> *"What countries have the most active users?"*
>
> *"Show me the top 10 most viewed pages today"*

---

## 🕸️ Neo4j

**What it is:** The world's leading graph database. Perfect for social networks, recommendation engines, fraud detection.

### Install the driver

```bash
npm install -g neo4j-driver
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "neo4j",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "7687",
        "MCP_DB_DATABASE": "neo4j",
        "MCP_DB_USER": "neo4j",
        "MCP_DB_PASSWORD": "password"
      }
    }
  }
}
```

### Neo4j Aura (cloud)

```json
{
  "env": {
    "MCP_DB_ENGINE": "neo4j",
    "MCP_DB_URL": "neo4j+s://xxxx.databases.neo4j.io",
    "MCP_DB_USER": "neo4j",
    "MCP_DB_PASSWORD": "your-password",
    "MCP_DB_SSL": "true"
  }
}
```

### How Neo4j queries work

Neo4j uses **Cypher**, not SQL. Cypher uses patterns like `(node)-[:RELATIONSHIP]->(otherNode)`.

### Query examples

**Find all people:**
```cypher
MATCH (p:Person) RETURN p.name, p.age LIMIT 20
```

**Find friends of a person:**
```
sql:    "MATCH (p:Person {name: $p0})-[:FRIENDS_WITH]->(friend) RETURN friend.name, friend.age"
params: ["Alice"]
```

**Find shortest path between two people:**
```
sql:    "MATCH path = shortestPath((a:Person {name: $p0})-[:FRIENDS_WITH*]-(b:Person {name: $p1})) RETURN path"
params: ["Alice", "Bob"]
```

**Find who works at a company:**
```
sql:    "MATCH (p:Person)-[:WORKS_AT]->(c:Company {name: $p0}) RETURN p.name, p.role, p.since ORDER BY p.since DESC"
params: ["Acme Corp"]
```

**Count relationships:**
```cypher
MATCH (p:Person)-[r]->(other)
RETURN type(r) AS relationship, count(r) AS count
ORDER BY count DESC
```

**Recommendation query (friends of friends):**
```
sql:    "MATCH (me:Person {name: $p0})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(suggestion) WHERE NOT (me)-[:FRIENDS_WITH]->(suggestion) AND suggestion <> me RETURN suggestion.name, count(friend) AS mutual_friends ORDER BY mutual_friends DESC LIMIT 10"
params: ["Alice"]
```

### Example prompts to Claude

> *"Who are Alice's friends?"*
>
> *"Find the shortest connection between Alice and Bob"*
>
> *"What companies have the most employees in our graph?"*
>
> *"Recommend new connections for Alice based on mutual friends"*

---

## ⚡ DynamoDB

**What it is:** AWS's fully managed NoSQL key-value and document database. Infinitely scalable.

### Install the drivers

```bash
npm install -g @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "dynamodb",
        "MCP_DB_REGION": "us-east-1",
        "MCP_DB_READ_ONLY": "true",
        "AWS_ACCESS_KEY_ID": "your-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret-key"
      }
    }
  }
}
```

### Local DynamoDB (for development)

```json
{
  "env": {
    "MCP_DB_ENGINE": "dynamodb",
    "MCP_DB_HOST": "localhost",
    "MCP_DB_PORT": "8000",
    "MCP_DB_REGION": "us-east-1",
    "MCP_DB_USER": "fakeAccessKey",
    "MCP_DB_PASSWORD": "fakeSecretKey"
  }
}
```

### How DynamoDB queries work

DynamoDB uses JSON commands with specific operations.

### Query examples

**Scan all items in a table (careful with large tables!):**
```json
{
  "operation": "scan",
  "table": "Users",
  "limit": 50
}
```

**Scan with filter:**
```json
{
  "operation": "scan",
  "table": "Users",
  "filter": "age > :minAge AND city = :city",
  "attributeValues": { ":minAge": 25, ":city": "London" },
  "limit": 50
}
```

**Query by partition key (fast!):**
```json
{
  "operation": "query",
  "table": "Orders",
  "keyCondition": "userId = :uid",
  "attributeValues": { ":uid": "user-123" },
  "limit": 20
}
```

**Query with sort key range:**
```json
{
  "operation": "query",
  "table": "Events",
  "keyCondition": "deviceId = :did AND eventTime BETWEEN :start AND :end",
  "attributeValues": {
    ":did": "sensor-01",
    ":start": "2024-06-01T00:00:00Z",
    ":end": "2024-06-30T23:59:59Z"
  },
  "scanForward": false
}
```

**Get a single item:**
```json
{
  "operation": "getItem",
  "table": "Users",
  "key": { "userId": "user-123" }
}
```

**Put an item:**
```json
{
  "operation": "putItem",
  "table": "Users",
  "item": {
    "userId": "user-456",
    "name": "Alice",
    "email": "alice@example.com",
    "age": 30
  }
}
```

**Update an item:**
```json
{
  "operation": "updateItem",
  "table": "Users",
  "key": { "userId": "user-123" },
  "updateExpression": "SET #n = :name, age = :age",
  "attributeNames": { "#n": "name" },
  "attributeValues": { ":name": "Alice Updated", ":age": 31 }
}
```

**Delete an item:**
```json
{
  "operation": "deleteItem",
  "table": "Users",
  "key": { "userId": "user-456" }
}
```

### Example prompts to Claude

> *"Show me all orders for user-123"*
>
> *"List all tables in my DynamoDB"*
>
> *"Describe the schema of the Users table"*

---

## 🔍 Elasticsearch / OpenSearch

**What it is:** A distributed search and analytics engine. Used for log analysis, full-text search, monitoring.

### Install the driver

```bash
npm install -g @elastic/elasticsearch
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "elasticsearch",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "9200",
        "MCP_DB_USER": "elastic",
        "MCP_DB_PASSWORD": "changeme",
        "MCP_DB_READ_ONLY": "true"
      }
    }
  }
}
```

### Elastic Cloud

```json
{
  "env": {
    "MCP_DB_ENGINE": "elasticsearch",
    "MCP_DB_URL": "https://my-deployment.es.us-east-1.aws.found.io:9243",
    "MCP_DB_USER": "elastic",
    "MCP_DB_PASSWORD": "your-password",
    "MCP_DB_SSL": "true"
  }
}
```

### How Elasticsearch queries work

You can use **Elasticsearch SQL** (easier) or **JSON DSL** (more powerful).

### Query examples — Elasticsearch SQL (easier)

```sql
SELECT title, author, published_date FROM articles WHERE match(title, 'machine learning') LIMIT 10
```

```sql
SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY count DESC
```

### Query examples — JSON DSL (more powerful)

**Full-text search:**
```json
{
  "operation": "search",
  "index": "articles",
  "body": {
    "query": { "match": { "title": "machine learning" } }
  },
  "size": 10
}
```

**Multi-field search:**
```json
{
  "operation": "search",
  "index": "articles",
  "body": {
    "query": {
      "multi_match": {
        "query": "database performance",
        "fields": ["title", "body", "tags"]
      }
    }
  },
  "size": 20
}
```

**Filter + search combined:**
```json
{
  "operation": "search",
  "index": "products",
  "body": {
    "query": {
      "bool": {
        "must": { "match": { "name": "laptop" } },
        "filter": [
          { "range": { "price": { "gte": 500, "lte": 2000 } } },
          { "term": { "in_stock": true } }
        ]
      }
    }
  },
  "sort": [{ "price": "asc" }],
  "size": 20
}
```

**Aggregations (analytics):**
```json
{
  "operation": "aggregate",
  "index": "logs",
  "aggs": {
    "status_codes": {
      "terms": { "field": "status_code" }
    },
    "avg_response_time": {
      "avg": { "field": "response_time_ms" }
    }
  }
}
```

**Index a document:**
```json
{
  "operation": "index",
  "index": "articles",
  "document": {
    "title": "Getting Started with MCP",
    "body": "This is a guide...",
    "tags": ["mcp", "ai", "databases"],
    "published": "2024-06-01"
  }
}
```

### Example prompts to Claude

> *"Search for articles about machine learning"*
>
> *"What are the most common HTTP status codes in our logs?"*
>
> *"Find all products matching 'wireless headphones' under $100"*

---

## 🛋️ CouchDB

**What it is:** A document database with a focus on reliability and ease of use. Uses HTTP/JSON for everything.

### Install the driver

```bash
npm install -g nano
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "couchdb",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "5984",
        "MCP_DB_DATABASE": "mydb",
        "MCP_DB_USER": "admin",
        "MCP_DB_PASSWORD": "password"
      }
    }
  }
}
```

### Query examples

**Find documents with Mango query:**
```json
{
  "operation": "find",
  "selector": { "type": "article", "published": true },
  "fields": ["title", "author", "date"],
  "sort": [{ "date": "desc" }],
  "limit": 20
}
```

**Get a single document by ID:**
```json
{
  "operation": "get",
  "id": "article-12345"
}
```

**List all documents:**
```json
{
  "operation": "allDocs",
  "includeDocs": true,
  "limit": 50
}
```

**Insert a document:**
```json
{
  "operation": "insert",
  "document": {
    "type": "article",
    "title": "Hello World",
    "body": "This is my first post",
    "published": true
  }
}
```

**Delete a document (requires ID and revision):**
```json
{
  "operation": "delete",
  "id": "article-12345",
  "rev": "1-abc123"
}
```

**Query a view:**
```json
{
  "operation": "view",
  "designDoc": "articles",
  "viewName": "by_date",
  "params": { "descending": true, "limit": 10 }
}
```

### Example prompts to Claude

> *"Show me all published articles"*
>
> *"Get the document with ID article-12345"*
>
> *"List all databases in my CouchDB"*

---

## 📈 InfluxDB

**What it is:** A time-series database built for metrics, events, and IoT data. Used for monitoring, dashboards, and analytics.

### Install the driver

```bash
npm install -g @influxdata/influxdb-client
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "influxdb",
        "MCP_DB_HOST": "localhost",
        "MCP_DB_PORT": "8086",
        "MCP_DB_DATABASE": "my-bucket",
        "MCP_DB_USER": "my-org",
        "MCP_DB_PASSWORD": "your-influxdb-token"
      }
    }
  }
}
```

> **Mapping:** `database` = bucket name, `username` = org name, `password` = API token.

### InfluxDB Cloud

```json
{
  "env": {
    "MCP_DB_ENGINE": "influxdb",
    "MCP_DB_URL": "https://us-east-1-1.aws.cloud2.influxdata.com",
    "MCP_DB_DATABASE": "my-bucket",
    "MCP_DB_USER": "my-org",
    "MCP_DB_PASSWORD": "your-api-token"
  }
}
```

### How InfluxDB queries work

InfluxDB v2 uses **Flux**, a functional query language.

### Query examples

**Get data from the last hour:**
```flux
from(bucket: "my-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "cpu")
  |> filter(fn: (r) => r._field == "usage_percent")
```

**Average CPU per host, last 24 hours:**
```flux
from(bucket: "my-bucket")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "cpu")
  |> filter(fn: (r) => r._field == "usage_percent")
  |> group(columns: ["host"])
  |> mean()
```

**Max temperature per device, last 7 days:**
```flux
from(bucket: "iot-data")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> group(columns: ["device_id"])
  |> max()
  |> sort(columns: ["_value"], desc: true)
```

**Downsample to hourly averages:**
```flux
from(bucket: "metrics")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "memory")
  |> aggregateWindow(every: 1h, fn: mean)
```

### Example prompts to Claude

> *"What's the average CPU usage across all servers in the last hour?"*
>
> *"Show me temperature readings from device sensor-01 today"*
>
> *"List all measurements in my InfluxDB bucket"*

---

## 🔥 Firestore

**What it is:** Google Cloud's serverless document database. Used by mobile and web apps. Real-time sync, offline support.

### Install the driver

```bash
npm install -g firebase-admin
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "mcp-database-server"],
      "env": {
        "MCP_DB_ENGINE": "firestore",
        "MCP_DB_PROJECT_ID": "my-firebase-project",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account-key.json"
      }
    }
  }
}
```

### Config file with service account

```json
{
  "connections": [{
    "id": "my-firestore",
    "engine": "firestore",
    "projectId": "my-firebase-project",
    "serviceAccountKeyPath": "/path/to/service-account-key.json"
  }]
}
```

> **How to get a service account key:**
> 1. Go to [Firebase Console](https://console.firebase.google.com)
> 2. Project Settings → Service Accounts
> 3. Click "Generate New Private Key"
> 4. Save the JSON file somewhere safe

### How Firestore queries work

Firestore uses JSON commands operating on **collections** and **documents**.

### Query examples

**List all documents in a collection:**
```json
{
  "operation": "list",
  "collection": "users",
  "limit": 50,
  "orderBy": "name"
}
```

**Get a single document by ID:**
```json
{
  "operation": "get",
  "collection": "users",
  "id": "user-abc-123"
}
```

**Query with filters:**
```json
{
  "operation": "query",
  "collection": "users",
  "where": [
    { "field": "age", "op": ">=", "value": 18 },
    { "field": "active", "op": "==", "value": true }
  ],
  "orderBy": "name",
  "limit": 20
}
```

Available operators: `==`, `!=`, `<`, `<=`, `>`, `>=`, `array-contains`, `array-contains-any`, `in`, `not-in`

**Add a new document (auto-generated ID):**
```json
{
  "operation": "add",
  "collection": "users",
  "data": {
    "name": "Alice",
    "email": "alice@example.com",
    "age": 30,
    "active": true
  }
}
```

**Set a document (specific ID, overwrites):**
```json
{
  "operation": "set",
  "collection": "users",
  "id": "user-abc-123",
  "data": { "name": "Alice", "email": "alice@example.com" },
  "merge": true
}
```

> **Tip:** Set `"merge": true` to only update the fields you provide, instead of overwriting the whole document.

**Update specific fields:**
```json
{
  "operation": "update",
  "collection": "users",
  "id": "user-abc-123",
  "data": { "age": 31, "lastLogin": "2024-06-01" }
}
```

**Delete a document:**
```json
{
  "operation": "delete",
  "collection": "users",
  "id": "user-abc-123"
}
```

### Example prompts to Claude

> *"List all active users in Firestore"*
>
> *"Get the profile for user-abc-123"*
>
> *"Find all orders where total is greater than 100"*
>
> *"Show me all collections in my Firestore"*

---

---

## 🔒 Security

This server takes security seriously. Here's everything that's built in:

### Protection Layer Summary

| Feature | What it does | Default |
|---------|-------------|---------|
| **SQL Injection Detection** | Detects UNION injection, stacked queries, timing attacks, encoding bypasses, comment obfuscation | ✅ ON |
| **NoSQL Injection Detection** | Detects `$where`, operator injection, JavaScript injection | ✅ ON |
| **Parameterized Queries** | All adapters use prepared statements | ✅ Always |
| **Read-Only Mode** | Blocks INSERT, UPDATE, DELETE when enabled | Set per connection |
| **DDL Control** | Block CREATE, ALTER, DROP, TRUNCATE | ❌ Blocked by default |
| **DML Control** | Allow/block INSERT, UPDATE, DELETE | ✅ Allowed by default |
| **Rate Limiting** | Max queries per minute per connection | 120/min |
| **Max Connections** | Hard cap on simultaneous connections | 20 |
| **Query Length Limit** | Reject excessively long queries | 50,000 chars |
| **Keyword Blocking** | Block specific keywords | Customizable |
| **Schema Access Control** | Allow-list or block-list schemas | System schemas blocked |
| **Audit Logging** | Log every query with timing and status | ✅ ON |
| **Connection String Masking** | Passwords redacted from logs | ✅ Always |
| **Query Timeout** | Kill queries that run too long | 30 seconds |
| **Result Truncation** | Cap large result sets | 1000 rows |
| **Graceful Shutdown** | Clean disconnect on SIGINT/SIGTERM | ✅ Always |

### Recommended production settings

```json
{
  "security": {
    "sqlInjectionProtection": true,
    "nosqlInjectionProtection": true,
    "maxQueryLength": 10000,
    "blockedKeywords": ["TRUNCATE", "DROP DATABASE", "DROP TABLE", "GRANT", "REVOKE"],
    "blockedSchemas": ["information_schema", "pg_catalog", "sys", "mysql", "performance_schema"],
    "allowDDL": false,
    "allowDML": false,
    "auditLogging": true,
    "rateLimitPerMinute": 30,
    "maxConnections": 5,
    "enforceParameterizedQueries": true
  }
}
```

> **Tip:** For maximum safety, set `"allowDML": false` and `"readOnly": true` on all connections. This makes the database completely read-only — Claude can explore and query but never modify data.

---

## 📋 Environment Variables Reference

### Single database connection

| Variable | Description | Example |
|----------|-------------|---------|
| `MCP_DB_ENGINE` | **Required.** Database type | `postgresql` |
| `MCP_DB_URL` | Connection string (overrides host/port/etc) | `postgresql://user:pass@host:5432/db` |
| `MCP_DB_HOST` | Hostname | `localhost` |
| `MCP_DB_PORT` | Port | `5432` |
| `MCP_DB_DATABASE` | Database name | `myapp` |
| `MCP_DB_USER` | Username | `postgres` |
| `MCP_DB_PASSWORD` | Password | `secret` |
| `MCP_DB_SSL` | Enable SSL (`true`/`false`) | `true` |
| `MCP_DB_READ_ONLY` | Read-only mode (`true`/`false`) | `true` |
| `MCP_DB_QUERY_TIMEOUT` | Query timeout in milliseconds | `30000` |
| `MCP_DB_MAX_ROWS` | Max rows per query result | `1000` |
| `MCP_DB_REGION` | AWS region (DynamoDB) | `us-east-1` |
| `MCP_DB_PROJECT_ID` | GCP project (Firestore) | `my-project` |
| `MCP_DB_ID` | Connection name | `default` |

### Multiple databases (indexed)

```bash
MCP_DB_0_ENGINE=postgresql
MCP_DB_0_ID=app-db
MCP_DB_0_URL=postgresql://...

MCP_DB_1_ENGINE=redis
MCP_DB_1_ID=cache
MCP_DB_1_HOST=localhost
MCP_DB_1_PORT=6379

# Up to MCP_DB_19 (20 connections)
```

### Security overrides

| Variable | Description | Example |
|----------|-------------|---------|
| `MCP_DB_READ_ONLY` | Force read-only for all connections | `true` |
| `MCP_DB_ALLOW_DDL` | Allow DDL statements | `false` |
| `MCP_DB_RATE_LIMIT` | Queries per minute | `60` |
| `MCP_DB_LOG_LEVEL` | Log verbosity | `info` |
| `MCP_DB_CONFIG` | Path to config file | `./config.json` |

---

## 🔧 Troubleshooting

### "Connection refused"

**Problem:** The database isn't running or isn't reachable.

**Fix:**
1. Make sure your database is running: `pg_isready` (Postgres), `redis-cli ping` (Redis), etc.
2. Check host and port are correct
3. If using Docker, make sure ports are mapped: `docker run -p 5432:5432 postgres`

---

### "Authentication failed"

**Problem:** Wrong username or password.

**Fix:**
1. Double-check your credentials
2. Make sure the user has permission to access the database
3. For PostgreSQL, check `pg_hba.conf` allows your connection method

---

### "Module not found" / "Cannot find module 'pg'"

**Problem:** The database driver isn't installed.

**Fix:**
```bash
# Install the driver for your database globally
npm install -g pg          # for PostgreSQL
npm install -g mysql2      # for MySQL
npm install -g mongodb     # for MongoDB
# etc.
```

---

### "SSL connection required"

**Problem:** The database requires SSL but it's not enabled.

**Fix:** Set `MCP_DB_SSL=true` in your environment, or add `ssl: { "enabled": true }` to your config.

---

### "Query blocked: DDL statements are not allowed"

**Problem:** You tried to run CREATE TABLE, ALTER TABLE, DROP, etc. and the security policy blocks it.

**Fix:** If you intentionally want to allow DDL, set `"allowDDL": true` in your security config. But think carefully — you probably don't want the LLM creating or dropping tables!

---

### "Rate limit exceeded"

**Problem:** Too many queries in a short time.

**Fix:** Wait a minute, or increase `rateLimitPerMinute` in your security config.

---

### "Query blocked: Potential SQL injection"

**Problem:** The security layer detected a suspicious pattern in your query.

**Fix:** Use parameterized queries instead of string concatenation:

```
# BAD (will be blocked):
sql: "SELECT * FROM users WHERE name = 'Alice'; DROP TABLE users;--'"

# GOOD (use params):
sql:    "SELECT * FROM users WHERE name = $1"
params: ["Alice"]
```

---

### Claude says "I don't have access to a database tool"

**Problem:** The MCP server isn't configured in Claude.

**Fix:**
1. Make sure your `claude_desktop_config.json` is saved correctly
2. Restart Claude Desktop completely
3. Check the file is valid JSON (no trailing commas!)

---

## 📦 Publishing to NPM

```bash
# 1. Make sure you're logged in to npm
npm login

# 2. Update the "name" field in package.json to your preferred name
#    e.g., "name": "my-mcp-database-server"

# 3. Build the project
npm run build

# 4. Test it locally first
node dist/index.js

# 5. Publish!
npm publish --access public

# 6. If using a scope (e.g., @myorg/mcp-database-server)
npm publish --access public
```

---

## 🏗 Architecture

```
src/
├── index.ts                    # Main entry — MCP server, all 12 tools
├── types/
│   ├── index.ts                # TypeScript types for everything
│   └── declarations.d.ts       # Module declarations for untyped drivers
├── adapters/
│   ├── base.ts                 # Abstract base class all adapters extend
│   ├── index.ts                # Factory + engine registry (22 engines)
│   ├── postgresql.ts           # PostgreSQL / CockroachDB / Neon / Supabase
│   ├── mysql.ts                # MySQL / MariaDB / PlanetScale / TiDB / SingleStore
│   ├── sqlite.ts               # SQLite (file-based)
│   ├── mongodb.ts              # MongoDB (document store)
│   ├── redis.ts                # Redis (key-value)
│   ├── mssql.ts                # Microsoft SQL Server
│   ├── oracle.ts               # Oracle Database
│   ├── cassandra.ts            # Cassandra / ScyllaDB
│   ├── clickhouse.ts           # ClickHouse (analytics)
│   ├── neo4j.ts                # Neo4j (graph)
│   ├── dynamodb.ts             # AWS DynamoDB
│   ├── elasticsearch.ts        # Elasticsearch / OpenSearch
│   ├── couchdb.ts              # Apache CouchDB
│   ├── influxdb.ts             # InfluxDB (time series)
│   └── firestore.ts            # Google Cloud Firestore
├── security/
│   └── index.ts                # SQL/NoSQL injection, rate limiter, audit logger
└── utils/
    └── config.ts               # Config loader (files, env vars, CLI args)
```

---

## 📄 License

MIT — do whatever you want with it.
