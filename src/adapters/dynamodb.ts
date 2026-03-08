// ============================================================================
// AWS DynamoDB Adapter
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  ConnectionConfig, QueryResult, TableInfo, SchemaInfo, ColumnInfo, DatabaseEngine,
} from '../types/index.js';

export class DynamoDBAdapter extends BaseAdapter {
  readonly engine: DatabaseEngine = 'dynamodb';
  private client: any = null;
  private docClient: any = null;

  constructor(connectionId: string) {
    super(connectionId);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
    this.config = config;

    const clientConfig: any = {
      region: config.region ?? config.options?.region ?? 'us-east-1',
    };

    if (config.host) {
      clientConfig.endpoint = config.connectionString ?? `http://${config.host}:${config.port ?? 8000}`;
    }

    if (config.username && config.password) {
      clientConfig.credentials = {
        accessKeyId: config.username,
        secretAccessKey: config.password,
      };
    }

    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.docClient = null;
    }
    this.connected = false;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const elapsed = this.startTimer();

    // Parse JSON command
    let cmd: any;
    try {
      cmd = JSON.parse(sql);
    } catch {
      throw new Error(
        'DynamoDB commands must be JSON: { "operation": "scan|query|getItem|putItem|deleteItem|updateItem", "table": "...", ... }'
      );
    }

    const { ScanCommand, QueryCommand, GetCommand, PutCommand, DeleteCommand, UpdateCommand } =
      await import('@aws-sdk/lib-dynamodb');

    let rows: Record<string, unknown>[] = [];
    let affectedRows: number | undefined;

    switch (cmd.operation) {
      case 'scan': {
        const result = await this.docClient.send(new ScanCommand({
          TableName: cmd.table,
          FilterExpression: cmd.filter,
          ExpressionAttributeNames: cmd.attributeNames,
          ExpressionAttributeValues: cmd.attributeValues,
          Limit: cmd.limit ?? (this.config?.maxRows ?? 1000),
        }));
        rows = result.Items ?? [];
        break;
      }
      case 'query': {
        const result = await this.docClient.send(new QueryCommand({
          TableName: cmd.table,
          KeyConditionExpression: cmd.keyCondition,
          FilterExpression: cmd.filter,
          ExpressionAttributeNames: cmd.attributeNames,
          ExpressionAttributeValues: cmd.attributeValues,
          Limit: cmd.limit ?? (this.config?.maxRows ?? 1000),
          ScanIndexForward: cmd.scanForward,
          IndexName: cmd.indexName,
        }));
        rows = result.Items ?? [];
        break;
      }
      case 'getItem': {
        const result = await this.docClient.send(new GetCommand({
          TableName: cmd.table,
          Key: cmd.key,
        }));
        rows = result.Item ? [result.Item] : [];
        break;
      }
      case 'putItem': {
        await this.docClient.send(new PutCommand({
          TableName: cmd.table,
          Item: cmd.item,
          ConditionExpression: cmd.condition,
        }));
        affectedRows = 1;
        rows = [{ status: 'inserted' }];
        break;
      }
      case 'deleteItem': {
        await this.docClient.send(new DeleteCommand({
          TableName: cmd.table,
          Key: cmd.key,
          ConditionExpression: cmd.condition,
        }));
        affectedRows = 1;
        rows = [{ status: 'deleted' }];
        break;
      }
      case 'updateItem': {
        const result = await this.docClient.send(new UpdateCommand({
          TableName: cmd.table,
          Key: cmd.key,
          UpdateExpression: cmd.updateExpression,
          ExpressionAttributeNames: cmd.attributeNames,
          ExpressionAttributeValues: cmd.attributeValues,
          ReturnValues: 'ALL_NEW',
        }));
        affectedRows = 1;
        rows = [result.Attributes ?? { status: 'updated' }];
        break;
      }
      default:
        throw new Error(`Unsupported DynamoDB operation: ${cmd.operation}`);
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
    const { ListTablesCommand, DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
    const result = await this.client.send(new ListTablesCommand({}));
    const tables: TableInfo[] = [];

    for (const name of result.TableNames ?? []) {
      try {
        const desc = await this.client.send(new DescribeTableCommand({ TableName: name }));
        tables.push({
          name,
          type: 'table',
          rowCount: desc.Table?.ItemCount ? Number(desc.Table.ItemCount) : undefined,
          sizeBytes: desc.Table?.TableSizeBytes ? Number(desc.Table.TableSizeBytes) : undefined,
        });
      } catch {
        tables.push({ name, type: 'table' });
      }
    }

    return tables;
  }

  async describeTable(table: string): Promise<SchemaInfo> {
    const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
    const desc = await this.client.send(new DescribeTableCommand({ TableName: table }));
    const t = desc.Table;

    const columns: ColumnInfo[] = (t?.AttributeDefinitions ?? []).map((attr: any) => ({
      name: attr.AttributeName,
      type: attr.AttributeType === 'S' ? 'String' : attr.AttributeType === 'N' ? 'Number' : 'Binary',
      nullable: false,
      isPrimaryKey: (t?.KeySchema ?? []).some((k: any) => k.AttributeName === attr.AttributeName),
    }));

    const indexes = (t?.GlobalSecondaryIndexes ?? []).map((gsi: any) => ({
      name: gsi.IndexName,
      columns: gsi.KeySchema.map((k: any) => k.AttributeName),
      unique: false,
      type: 'GSI',
    }));

    return { table, columns, indexes };
  }

  async ping(): Promise<boolean> {
    try {
      const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
      await this.client.send(new ListTablesCommand({ Limit: 1 }));
      return true;
    } catch {
      return false;
    }
  }
}
