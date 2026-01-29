import Database from 'better-sqlite3';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ColumnInfo } from './database-connector';

export interface BuilderOptions {
  outputPath: string;
  fileName: string;
  compress?: boolean;
  encrypt?: boolean;
  encryptionKey?: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
}

/**
 * SQLite Builder - Creates SQLite databases from source data
 */
export class SQLiteBuilder {
  private db: Database.Database | null = null;
  private options: BuilderOptions;
  private filePath: string;
  private tempPath: string;

  constructor(options: BuilderOptions) {
    this.options = options;
    
    // Ensure output directory exists
    if (!existsSync(options.outputPath)) {
      mkdirSync(options.outputPath, { recursive: true });
    }
    
    // Create temp file first, then rename when complete
    this.tempPath = path.join(options.outputPath, `.${options.fileName}.tmp`);
    this.filePath = path.join(options.outputPath, options.fileName);
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    // Remove temp file if it exists
    if (existsSync(this.tempPath)) {
      unlinkSync(this.tempPath);
    }

    this.db = new Database(this.tempPath);
    
    // Optimize for bulk inserts
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
  }

  /**
   * Create a table in the SQLite database
   */
  createTable(schema: TableSchema): void {
    if (!this.db) throw new Error('Database not initialized');

    const columnDefs = schema.columns.map(col => {
      const sqliteType = this.mapToSQLiteType(col.type);
      const nullable = col.nullable ? '' : ' NOT NULL';
      const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
      return `"${col.name}" ${sqliteType}${nullable}${pk}`;
    }).join(', ');

    const sql = `CREATE TABLE IF NOT EXISTS "${schema.name}" (${columnDefs})`;
    this.db.exec(sql);
  }

  /**
   * Insert rows into a table
   */
  insertRows(tableName: string, columns: string[], rows: Record<string, unknown>[]): number {
    if (!this.db) throw new Error('Database not initialized');
    if (rows.length === 0) return 0;

    const placeholders = columns.map(() => '?').join(', ');
    const quotedColumns = columns.map(c => `"${c}"`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})`;
    
    const stmt = this.db.prepare(sql);
    
    const insertMany = this.db.transaction((rows: Record<string, unknown>[]) => {
      let count = 0;
      for (const row of rows) {
        const values = columns.map(col => this.convertValue(row[col]));
        stmt.run(...values);
        count++;
      }
      return count;
    });

    return insertMany(rows);
  }

  /**
   * Insert rows in batches for better performance
   */
  async insertBatch(
    tableName: string, 
    columns: string[], 
    rowGenerator: AsyncGenerator<Record<string, unknown>[]>,
    onProgress?: (count: number) => void
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    let totalRows = 0;
    const placeholders = columns.map(() => '?').join(', ');
    const quotedColumns = columns.map(c => `"${c}"`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})`;
    const stmt = this.db.prepare(sql);

    const insertBatch = this.db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const values = columns.map(col => this.convertValue(row[col]));
        stmt.run(...values);
      }
    });

    for await (const batch of rowGenerator) {
      insertBatch(batch);
      totalRows += batch.length;
      if (onProgress) onProgress(totalRows);
    }

    return totalRows;
  }

  /**
   * Create indexes for better query performance
   */
  createIndex(tableName: string, columns: string[], unique: boolean = false): void {
    if (!this.db) throw new Error('Database not initialized');

    const indexName = `idx_${tableName}_${columns.join('_')}`;
    const uniqueStr = unique ? 'UNIQUE ' : '';
    const columnList = columns.map(c => `"${c}"`).join(', ');
    
    const sql = `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" (${columnList})`;
    this.db.exec(sql);
  }

  /**
   * Add metadata table with sync info
   */
  addMetadata(metadata: Record<string, string>): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _syncengine_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    const stmt = this.db.prepare('INSERT OR REPLACE INTO _syncengine_metadata (key, value) VALUES (?, ?)');
    
    for (const [key, value] of Object.entries(metadata)) {
      stmt.run(key, value);
    }

    // Add standard metadata
    stmt.run('sync_timestamp', new Date().toISOString());
    stmt.run('syncengine_version', '1.0.0');
  }

  /**
   * Finalize the database and apply compression/encryption if needed
   */
  async finalize(): Promise<{ filePath: string; fileSize: number }> {
    if (!this.db) throw new Error('Database not initialized');

    // Optimize database
    this.db.pragma('optimize');
    this.db.exec('VACUUM');
    
    // Close the database
    this.db.close();
    this.db = null;

    let finalPath = this.filePath;

    // Apply compression if enabled
    if (this.options.compress) {
      const compressedPath = `${this.filePath}.gz`;
      await this.compressFile(this.tempPath, compressedPath);
      unlinkSync(this.tempPath);
      finalPath = compressedPath;
    } else {
      // Rename temp file to final name
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
      const fs = await import('fs/promises');
      await fs.rename(this.tempPath, this.filePath);
    }

    // Apply encryption if enabled
    if (this.options.encrypt && this.options.encryptionKey) {
      const encryptedPath = `${finalPath}.enc`;
      await this.encryptFile(finalPath, encryptedPath, this.options.encryptionKey);
      unlinkSync(finalPath);
      finalPath = encryptedPath;
    }

    const stats = statSync(finalPath);
    return {
      filePath: finalPath,
      fileSize: stats.size,
    };
  }

  /**
   * Clean up on error
   */
  cleanup(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (existsSync(this.tempPath)) {
      unlinkSync(this.tempPath);
    }
  }

  /**
   * Map source database types to SQLite types
   */
  private mapToSQLiteType(sourceType: string): string {
    const type = sourceType.toLowerCase();
    
    // Integer types
    if (type.includes('int') || type.includes('serial')) {
      return 'INTEGER';
    }
    
    // Real/Float types
    if (type.includes('float') || type.includes('double') || type.includes('decimal') || 
        type.includes('numeric') || type.includes('real') || type.includes('money')) {
      return 'REAL';
    }
    
    // Boolean
    if (type.includes('bool') || type.includes('bit')) {
      return 'INTEGER';
    }
    
    // Date/Time types
    if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
      return 'TEXT';
    }
    
    // Binary types
    if (type.includes('blob') || type.includes('binary') || type.includes('bytea')) {
      return 'BLOB';
    }
    
    // Default to TEXT for everything else
    return 'TEXT';
  }

  /**
   * Convert a value for SQLite insertion
   */
  private convertValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    return value;
  }

  /**
   * Compress file using gzip
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    const gzip = createGzip({ level: 9 });
    
    await pipeline(input, gzip, output);
  }

  /**
   * Encrypt file using AES-256-GCM
   */
  private async encryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    
    const derivedKey = crypto.scryptSync(key, 'syncengine-file-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    
    // Write IV to output first
    output.write(iv);
    
    await pipeline(input, cipher, output);
    
    // Append auth tag
    const authTag = cipher.getAuthTag();
    output.write(authTag);
  }
}

/**
 * Create a new SQLite builder instance
 */
export function createSQLiteBuilder(options: BuilderOptions): SQLiteBuilder {
  return new SQLiteBuilder(options);
}

