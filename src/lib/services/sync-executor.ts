import prisma from '../db';
import { createConnector, DatabaseConnector, TableInfo } from './database-connector';
import { createSQLiteBuilder, SQLiteBuilder } from './sqlite-builder';
import { maskValue, MaskingType } from './data-masking';
import path from 'path';

export interface SyncProgress {
  status: 'running' | 'completed' | 'failed';
  tablesProcessed: number;
  totalTables: number;
  rowsProcessed: number;
  currentTable?: string;
  error?: string;
}

export type ProgressCallback = (progress: SyncProgress) => void;

/**
 * Execute a sync job
 */
export async function executeSync(
  syncConfigId: string,
  triggeredBy: 'manual' | 'schedule' | 'api' = 'manual',
  onProgress?: ProgressCallback
): Promise<string> {
  // Create the sync job record
  const syncJob = await prisma.syncJob.create({
    data: {
      syncConfigId,
      status: 'pending',
      triggeredBy,
    },
  });

  const jobId = syncJob.id;

  try {
    // Update status to running
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Get sync configuration with all related data
    const syncConfig = await prisma.syncConfig.findUnique({
      where: { id: syncConfigId },
      include: {
        dataSource: true,
        tableConfigs: {
          where: { isActive: true },
          include: { columnConfigs: true },
        },
      },
    });

    if (!syncConfig) {
      throw new Error('Sync configuration not found');
    }

    if (!syncConfig.dataSource) {
      throw new Error('Data source not found');
    }

    if (syncConfig.tableConfigs.length === 0) {
      throw new Error('No tables configured for sync');
    }

    // Log sync start
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_started',
        eventDetails: JSON.stringify({
          configName: syncConfig.name,
          tables: syncConfig.tableConfigs.length,
        }),
        resourceType: 'sync_job',
        resourceId: jobId,
        dataSourceId: syncConfig.dataSourceId,
      },
    });

    // Create database connector
    const connector = createConnector({
      dbType: syncConfig.dataSource.dbType as 'postgresql' | 'mysql' | 'mssql',
      host: syncConfig.dataSource.host,
      port: syncConfig.dataSource.port,
      database: syncConfig.dataSource.database,
      username: syncConfig.dataSource.username,
      password: syncConfig.dataSource.password,
      sslEnabled: syncConfig.dataSource.sslEnabled,
    });

    // Create SQLite builder
    const builder = createSQLiteBuilder({
      outputPath: syncConfig.outputPath,
      fileName: syncConfig.outputFileName,
      compress: syncConfig.compressOutput,
      encrypt: syncConfig.encryptOutput,
      encryptionKey: process.env.ENCRYPTION_KEY,
    });

    await connector.connect();
    await builder.initialize();

    let totalRowsProcessed = 0;
    let tablesProcessed = 0;
    const totalTables = syncConfig.tableConfigs.length;

    // Process each table
    for (const tableConfig of syncConfig.tableConfigs) {
      const tableName = tableConfig.targetTable || tableConfig.sourceTable;
      
      // Report progress
      if (onProgress) {
        onProgress({
          status: 'running',
          tablesProcessed,
          totalTables,
          rowsProcessed: totalRowsProcessed,
          currentTable: tableName,
        });
      }

      // Update job progress
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          tablesProcessed,
          rowsProcessed: totalRowsProcessed,
        },
      });

      // Get columns to include
      const includedColumns = tableConfig.columnConfigs
        .filter(c => c.isIncluded)
        .map(c => ({
          source: c.sourceColumn,
          target: c.targetColumn || c.sourceColumn,
          maskingType: c.maskingType as MaskingType,
          maskingConfig: c.maskingConfig ? JSON.parse(c.maskingConfig) : undefined,
          dataType: c.dataType || 'TEXT',
          isPrimaryKey: c.isPrimaryKey,
        }));

      if (includedColumns.length === 0) {
        // If no columns configured, get all columns from source
        const sourceColumns = await connector.getTableColumns(
          tableConfig.sourceSchema,
          tableConfig.sourceTable
        );
        includedColumns.push(...sourceColumns.map(c => ({
          source: c.name,
          target: c.name,
          maskingType: 'none' as MaskingType,
          maskingConfig: undefined,
          dataType: c.type,
          isPrimaryKey: c.isPrimaryKey,
        })));
      }

      // Create table in SQLite
      builder.createTable({
        name: tableName,
        columns: includedColumns.map(c => ({
          name: c.target,
          type: c.dataType,
          nullable: true,
          isPrimaryKey: c.isPrimaryKey,
        })),
      });

      // Build SELECT query
      const selectColumns = includedColumns.map(c => 
        `"${c.source}"${c.source !== c.target ? ` AS "${c.target}"` : ''}`
      ).join(', ');
      
      let query = `SELECT ${selectColumns} FROM "${tableConfig.sourceSchema}"."${tableConfig.sourceTable}"`;
      
      if (tableConfig.whereClause) {
        query += ` WHERE ${tableConfig.whereClause}`;
      }
      
      if (tableConfig.rowLimit) {
        // This is database-specific, using LIMIT for simplicity
        query += ` LIMIT ${tableConfig.rowLimit}`;
      }

      // Stream data from source and insert into SQLite
      const targetColumns = includedColumns.map(c => c.target);
      let tableRows = 0;

      // Create a masking function for this table
      const maskRow = (row: Record<string, unknown>): Record<string, unknown> => {
        const maskedRow: Record<string, unknown> = {};
        for (const col of includedColumns) {
          const value = row[col.source];
          maskedRow[col.target] = col.maskingType !== 'none'
            ? maskValue(value, col.maskingType, col.maskingConfig)
            : value;
        }
        return maskedRow;
      };

      // Stream and insert data
      const rowGenerator = connector.streamQuery(query, [], 1000);
      
      for await (const batch of rowGenerator) {
        // Apply masking to each row
        const maskedBatch = batch.map(maskRow);
        
        // Insert into SQLite
        builder.insertRows(tableName, targetColumns, maskedBatch);
        
        tableRows += batch.length;
        totalRowsProcessed += batch.length;

        // Update progress periodically
        if (tableRows % 10000 === 0) {
          await prisma.syncJob.update({
            where: { id: jobId },
            data: { rowsProcessed: totalRowsProcessed },
          });
        }
      }

      // Create indexes for primary key columns
      const pkColumns = includedColumns.filter(c => c.isPrimaryKey).map(c => c.target);
      if (pkColumns.length > 0) {
        builder.createIndex(tableName, pkColumns, true);
      }

      // Update last sync value for incremental syncs
      if (tableConfig.incrementalColumn) {
        // TODO: Track last synced value for incremental syncs
      }

      tablesProcessed++;
    }

    // Add metadata
    builder.addMetadata({
      source_database: syncConfig.dataSource.name,
      source_type: syncConfig.dataSource.dbType,
      sync_config: syncConfig.name,
      sync_mode: syncConfig.syncMode,
      tables_count: String(tablesProcessed),
      rows_count: String(totalRowsProcessed),
    });

    // Finalize the database
    const result = await builder.finalize();

    // Disconnect from source
    await connector.disconnect();

    // Update job as completed
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        tablesProcessed,
        rowsProcessed: totalRowsProcessed,
        outputFilePath: result.filePath,
        outputFileSize: result.fileSize,
      },
    });

    // Log completion
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_completed',
        eventDetails: JSON.stringify({
          jobId,
          tables: tablesProcessed,
          rows: totalRowsProcessed,
          fileSize: result.fileSize,
          filePath: result.filePath,
        }),
        resourceType: 'sync_job',
        resourceId: jobId,
        dataSourceId: syncConfig.dataSourceId,
      },
    });

    // Report final progress
    if (onProgress) {
      onProgress({
        status: 'completed',
        tablesProcessed,
        totalTables,
        rowsProcessed: totalRowsProcessed,
      });
    }

    return jobId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : undefined;

    // Update job as failed
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
        errorDetails,
      },
    });

    // Log failure
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_failed',
        eventDetails: JSON.stringify({ jobId, error: errorMessage }),
        resourceType: 'sync_job',
        resourceId: jobId,
      },
    });

    // Report error progress
    if (onProgress) {
      onProgress({
        status: 'failed',
        tablesProcessed: 0,
        totalTables: 0,
        rowsProcessed: 0,
        error: errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Cancel a running sync job
 */
export async function cancelSync(jobId: string): Promise<void> {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  if (job.status !== 'running' && job.status !== 'pending') {
    throw new Error('Job is not running or pending');
  }

  // Update status to cancelled
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
    },
  });

  // Log cancellation
  await prisma.auditLog.create({
    data: {
      eventType: 'sync_cancelled',
      eventDetails: JSON.stringify({ jobId }),
      resourceType: 'sync_job',
      resourceId: jobId,
    },
  });
}

