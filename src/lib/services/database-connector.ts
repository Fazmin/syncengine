import { Pool as PgPool, PoolClient as PgClient } from 'pg';
import mysql, { Pool as MySQLPool, PoolConnection as MySQLConnection } from 'mysql2/promise';
import { Connection as TediousConnection, Request, TYPES } from 'tedious';
import Database from 'better-sqlite3';
import { decrypt, isEncrypted } from '../encryption';

export type DatabaseType = 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'sqlite';

export interface ConnectionConfig {
  dbType: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
}

export interface TableInfo {
  schema: string;
  table: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Abstract database connector interface
 */
export interface DatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  getTables(): Promise<TableInfo[]>;
  getTableColumns(schema: string, table: string): Promise<ColumnInfo[]>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  streamQuery(sql: string, params?: unknown[], batchSize?: number): AsyncGenerator<Record<string, unknown>[]>;
}

/**
 * Get decrypted password
 */
function getPassword(password: string): string {
  if (isEncrypted(password)) {
    return decrypt(password);
  }
  return password;
}

/**
 * PostgreSQL Connector
 */
export class PostgreSQLConnector implements DatabaseConnector {
  private pool: PgPool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = new PgPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: getPassword(this.config.password),
      ssl: this.config.sslEnabled ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      const client = await this.pool!.connect();
      await client.query('SELECT 1');
      client.release();
      await this.disconnect();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      await this.disconnect();
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT 
        table_schema as schema,
        table_name as table
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const columns = await this.getTableColumns(
        row.schema as string, 
        row.table as string
      );
      tables.push({
        schema: row.schema as string,
        table: row.table as string,
        columns,
      });
    }

    return tables;
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.query(`
      SELECT 
        c.column_name as name,
        c.data_type as type,
        c.is_nullable = 'YES' as nullable,
        c.column_default as default_value,
        COALESCE(pk.is_primary_key, false) as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name, true as is_primary_key
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [schema, table]);

    return result.rows.map(row => ({
      name: row.name as string,
      type: row.type as string,
      nullable: row.nullable as boolean,
      isPrimaryKey: row.is_primary_key as boolean,
      defaultValue: row.default_value as string | undefined,
    }));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) await this.connect();
    const result = await this.pool!.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }

  async *streamQuery(
    sql: string, 
    params?: unknown[], 
    batchSize: number = 1000
  ): AsyncGenerator<Record<string, unknown>[]> {
    if (!this.pool) await this.connect();
    
    const client = await this.pool!.connect();
    try {
      // Use cursor for streaming large results
      const cursorName = `cursor_${Date.now()}`;
      await client.query('BEGIN');
      await client.query(`DECLARE ${cursorName} CURSOR FOR ${sql}`, params);
      
      let batch: Record<string, unknown>[];
      do {
        const result = await client.query(`FETCH ${batchSize} FROM ${cursorName}`);
        batch = result.rows;
        if (batch.length > 0) {
          yield batch;
        }
      } while (batch.length === batchSize);
      
      await client.query(`CLOSE ${cursorName}`);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }
}

/**
 * MySQL Connector
 */
export class MySQLConnector implements DatabaseConnector {
  private pool: MySQLPool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: getPassword(this.config.password),
      ssl: this.config.sslEnabled ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      const conn = await this.pool!.getConnection();
      await conn.query('SELECT 1');
      conn.release();
      await this.disconnect();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      await this.disconnect();
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT 
        TABLE_SCHEMA as \`schema\`,
        TABLE_NAME as \`table\`
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const columns = await this.getTableColumns(
        row.schema as string, 
        row.table as string
      );
      tables.push({
        schema: row.schema as string,
        table: row.table as string,
        columns,
      });
    }

    return tables;
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.query(`
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE = 'YES' as nullable,
        COLUMN_DEFAULT as default_value,
        COLUMN_KEY = 'PRI' as is_primary_key
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [schema, table]);

    return result.rows.map(row => ({
      name: row.name as string,
      type: row.type as string,
      nullable: Boolean(row.nullable),
      isPrimaryKey: Boolean(row.is_primary_key),
      defaultValue: row.default_value as string | undefined,
    }));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) await this.connect();
    const [rows] = await this.pool!.query(sql, params);
    const resultRows = Array.isArray(rows) ? rows : [];
    return {
      rows: resultRows as Record<string, unknown>[],
      rowCount: resultRows.length,
    };
  }

  async *streamQuery(
    sql: string, 
    params?: unknown[], 
    batchSize: number = 1000
  ): AsyncGenerator<Record<string, unknown>[]> {
    if (!this.pool) await this.connect();
    
    let offset = 0;
    let batch: Record<string, unknown>[];
    
    do {
      const paginatedSql = `${sql} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await this.query(paginatedSql, params);
      batch = result.rows;
      if (batch.length > 0) {
        yield batch;
      }
      offset += batchSize;
    } while (batch.length === batchSize);
  }
}

/**
 * SQL Server Connector (using Tedious)
 */
export class MSSQLConnector implements DatabaseConnector {
  private connection: TediousConnection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection = new TediousConnection({
        server: this.config.host,
        authentication: {
          type: 'default',
          options: {
            userName: this.config.username,
            password: getPassword(this.config.password),
          },
        },
        options: {
          port: this.config.port,
          database: this.config.database,
          encrypt: this.config.sslEnabled,
          trustServerCertificate: true,
          connectTimeout: 10000,
        },
      });

      this.connection.on('connect', (err) => {
        if (err) reject(err);
        else resolve();
      });

      this.connection.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.query('SELECT 1 AS test');
      await this.disconnect();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      await this.disconnect();
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT 
        s.name as [schema],
        t.name as [table]
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.type = 'U'
      ORDER BY s.name, t.name
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const columns = await this.getTableColumns(
        row.schema as string, 
        row.table as string
      );
      tables.push({
        schema: row.schema as string,
        table: row.table as string,
        columns,
      });
    }

    return tables;
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.query(`
      SELECT 
        c.name as name,
        t.name as type,
        c.is_nullable as nullable,
        CAST(CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) as is_primary_key
      FROM sys.columns c
      INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
      INNER JOIN sys.tables tab ON c.object_id = tab.object_id
      INNER JOIN sys.schemas s ON tab.schema_id = s.schema_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      WHERE s.name = @schema AND tab.name = @table
      ORDER BY c.column_id
    `);

    return result.rows.map(row => ({
      name: row.name as string,
      type: row.type as string,
      nullable: Boolean(row.nullable),
      isPrimaryKey: Boolean(row.is_primary_key),
    }));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.connection) await this.connect();

    return new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      
      const request = new Request(sql, (err, rowCount) => {
        if (err) reject(err);
        else resolve({ rows, rowCount });
      });

      request.on('row', (columns) => {
        const row: Record<string, unknown> = {};
        columns.forEach((col: { metadata: { colName: string }; value: unknown }) => {
          row[col.metadata.colName] = col.value;
        });
        rows.push(row);
      });

      // Add parameters if provided
      if (params) {
        params.forEach((param, index) => {
          const paramName = `param${index}`;
          request.addParameter(paramName, TYPES.NVarChar, param);
        });
      }

      this.connection!.execSql(request);
    });
  }

  async *streamQuery(
    sql: string, 
    params?: unknown[], 
    batchSize: number = 1000
  ): AsyncGenerator<Record<string, unknown>[]> {
    // MSSQL streaming with OFFSET FETCH
    let offset = 0;
    let batch: Record<string, unknown>[];
    
    do {
      const paginatedSql = `${sql} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY`;
      const result = await this.query(paginatedSql, params);
      batch = result.rows;
      if (batch.length > 0) {
        yield batch;
      }
      offset += batchSize;
    } while (batch.length === batchSize);
  }
}

/**
 * SQLite Connector
 */
export class SQLiteConnector implements DatabaseConnector {
  private db: Database.Database | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // For SQLite, the 'database' field contains the file path
    this.db = new Database(this.config.database, { readonly: false });
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      this.db!.prepare('SELECT 1').get();
      await this.disconnect();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      await this.disconnect();
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    if (!this.db) await this.connect();
    
    const tablesResult = this.db!.prepare(`
      SELECT name as table_name 
      FROM sqlite_master 
      WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { table_name: string }[];

    const tables: TableInfo[] = [];
    for (const row of tablesResult) {
      const columns = await this.getTableColumns('main', row.table_name);
      tables.push({
        schema: 'main',
        table: row.table_name,
        columns,
      });
    }

    return tables;
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    if (!this.db) await this.connect();
    
    const columnsResult = this.db!.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }[];

    return columnsResult.map(col => ({
      name: col.name,
      type: col.type || 'TEXT',
      nullable: col.notnull === 0,
      isPrimaryKey: col.pk === 1,
      defaultValue: col.dflt_value || undefined,
    }));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.db) await this.connect();
    
    const stmt = this.db!.prepare(sql);
    
    // Check if it's a SELECT query
    if (sql.trim().toUpperCase().startsWith('SELECT') || 
        sql.trim().toUpperCase().startsWith('PRAGMA')) {
      const rows = params ? stmt.all(...params) : stmt.all();
      return {
        rows: rows as Record<string, unknown>[],
        rowCount: rows.length,
      };
    } else {
      // For INSERT/UPDATE/DELETE
      const result = params ? stmt.run(...params) : stmt.run();
      return {
        rows: [],
        rowCount: result.changes,
      };
    }
  }

  async *streamQuery(
    sql: string, 
    params?: unknown[], 
    batchSize: number = 1000
  ): AsyncGenerator<Record<string, unknown>[]> {
    if (!this.db) await this.connect();
    
    let offset = 0;
    let batch: Record<string, unknown>[];
    
    do {
      const paginatedSql = `${sql} LIMIT ${batchSize} OFFSET ${offset}`;
      const result = await this.query(paginatedSql, params);
      batch = result.rows;
      if (batch.length > 0) {
        yield batch;
      }
      offset += batchSize;
    } while (batch.length === batchSize);
  }
}

/**
 * Factory function to create appropriate connector
 */
export function createConnector(config: ConnectionConfig): DatabaseConnector {
  switch (config.dbType) {
    case 'postgresql':
      return new PostgreSQLConnector(config);
    case 'mysql':
      return new MySQLConnector(config);
    case 'mssql':
      return new MSSQLConnector(config);
    case 'sqlite':
      return new SQLiteConnector(config);
    default:
      throw new Error(`Unsupported database type: ${config.dbType}`);
  }
}

/**
 * Test connection for a data source configuration
 */
export async function testDatabaseConnection(config: ConnectionConfig): Promise<{ success: boolean; message: string }> {
  const connector = createConnector(config);
  return connector.testConnection();
}

/**
 * Discover tables from a data source
 */
export async function discoverTables(config: ConnectionConfig): Promise<TableInfo[]> {
  const connector = createConnector(config);
  try {
    await connector.connect();
    const tables = await connector.getTables();
    return tables;
  } finally {
    await connector.disconnect();
  }
}

