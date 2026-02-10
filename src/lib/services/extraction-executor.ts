import prisma from '../db';
import { WebScraper, createScraperFromWebSource } from './web-scraper';
import { createConnector, DatabaseConnector } from './database-connector';
import { LLMExtractor } from './llm-extractor';
import { decrypt, isEncrypted } from '../encryption';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ExtractionRule,
  ExtractedData,
  PaginationConfig,
  LLMCaptureConfig,
  LogLevel,
} from '@/types';

// Output directory for staged JSON files
const STAGING_DIR = './output/staging';

/**
 * Extraction Executor Service
 * Orchestrates the extraction process for assignments
 */
export class ExtractionExecutor {
  private scraper: WebScraper | null = null;
  private dbConnector: DatabaseConnector | null = null;
  private jobId: string | null = null;

  /**
   * Run extraction for an assignment
   */
  async runExtraction(
    assignmentId: string,
    mode: 'manual' | 'auto',
    triggeredBy: 'manual' | 'schedule' | 'api' = 'manual'
  ): Promise<string> {
    // Get assignment with relations
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        dataSource: true,
        webSource: true,
        extractionRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    if (!assignment.dataSource || !assignment.webSource) {
      throw new Error('Assignment missing data source or web source');
    }

    const isLLMMode = assignment.extractionMethod === 'llm';

    if (!isLLMMode && assignment.extractionRules.length === 0) {
      throw new Error('No active extraction rules configured');
    }

    if (isLLMMode && !assignment.llmCaptureConfig) {
      throw new Error('LLM extraction mode requires a structured capture configuration. Run "Create Structured Capture" first.');
    }

    // Create extraction job
    const job = await prisma.extractionJob.create({
      data: {
        assignmentId,
        status: 'pending',
        syncMode: mode,
        triggeredBy,
      },
    });

    this.jobId = job.id;

    try {
      // Update job status to running
      await this.updateJobStatus('running');
      await this.log('info', `Starting extraction job (${isLLMMode ? 'LLM' : 'selector'} mode)`);

      // Initialize scraper
      this.scraper = createScraperFromWebSource(assignment.webSource);

      // Get URLs to scrape
      const urls = await this.getUrlsToScrape(assignment);
      await this.updateJob({ pagesTotal: urls.length });
      await this.log('info', `Found ${urls.length} pages to scrape`);

      // Extract data from all URLs
      const allRows: Record<string, unknown>[] = [];
      let pagesProcessed = 0;

      if (isLLMMode) {
        // LLM-based extraction
        const captureConfig: LLMCaptureConfig = JSON.parse(assignment.llmCaptureConfig!);
        const llmExtractor = new LLMExtractor(captureConfig.model);

        for (const url of urls) {
          try {
            await this.log('debug', `LLM extracting: ${url}`, undefined, url);

            const html = await this.scraper.fetchHtml(url);
            const rows = await llmExtractor.extractWithStructuredOutput(html, captureConfig, url);

            allRows.push(...rows);
            pagesProcessed++;

            await this.updateJob({
              pagesProcessed,
              rowsExtracted: allRows.length,
              currentUrl: url,
            });

            await this.log('info', `LLM extracted ${rows.length} rows from page`, undefined, url);
          } catch (error) {
            await this.log('error', `LLM extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined, url);
          }
        }
      } else {
        // Selector-based extraction (existing behavior)
        for (const url of urls) {
          try {
            await this.log('debug', `Scraping: ${url}`, undefined, url);

            const data = await this.scraper.scrapeUrl(
              url,
              assignment.extractionRules as unknown as ExtractionRule[]
            );

            allRows.push(...data.rows);
            pagesProcessed++;

            await this.updateJob({
              pagesProcessed,
              rowsExtracted: allRows.length,
              currentUrl: url,
            });

            await this.log('info', `Extracted ${data.rows.length} rows from page`, undefined, url);
          } catch (error) {
            await this.log('error', `Failed to scrape: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined, url);
          }
        }
      }

      // Handle based on sync mode
      if (mode === 'manual') {
        // Stage data to JSON
        await this.stageToJson(allRows);
        await this.updateJobStatus('staging');
        await this.log('info', `Staged ${allRows.length} rows for review`);
      } else {
        // Auto mode: insert directly to database
        await this.insertToDatabase(assignment, allRows);
        await this.updateJobStatus('completed');
        await this.log('info', `Inserted ${allRows.length} rows to database`);
      }

      return job.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJob({
        status: 'failed',
        errorMessage,
        errorDetails: error instanceof Error ? error.stack : undefined,
        completedAt: new Date(),
      });
      await this.log('error', `Extraction failed: ${errorMessage}`);
      throw error;
    } finally {
      // Cleanup
      if (this.scraper) {
        await this.scraper.closeBrowser();
      }
      if (this.dbConnector) {
        await this.dbConnector.disconnect();
      }
    }
  }

  /**
   * Stage extracted data to JSON file
   */
  private async stageToJson(rows: Record<string, unknown>[]): Promise<void> {
    if (!this.jobId) throw new Error('No active job');

    const jsonData = JSON.stringify(rows, null, 2);
    const dataSize = Buffer.byteLength(jsonData, 'utf8');

    // For small datasets (<1MB), store inline
    if (dataSize < 1024 * 1024) {
      await this.updateJob({
        stagedDataJson: jsonData,
        stagedRowCount: rows.length,
      });
    } else {
      // For larger datasets, write to file
      await fs.mkdir(STAGING_DIR, { recursive: true });
      const filePath = path.join(STAGING_DIR, `${this.jobId}.json`);
      await fs.writeFile(filePath, jsonData, 'utf8');
      
      await this.updateJob({
        stagedDataPath: filePath,
        stagedRowCount: rows.length,
      });
    }
  }

  /**
   * Commit staged data to database (for manual mode)
   */
  async commitToDatabase(jobId: string): Promise<void> {
    const job = await prisma.extractionJob.findUnique({
      where: { id: jobId },
      include: {
        assignment: {
          include: {
            dataSource: true,
            extractionRules: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'staging') {
      throw new Error(`Job is not in staging status: ${job.status}`);
    }

    this.jobId = jobId;

    try {
      // Get staged data
      let rows: Record<string, unknown>[];
      
      if (job.stagedDataJson) {
        rows = JSON.parse(job.stagedDataJson);
      } else if (job.stagedDataPath) {
        const jsonData = await fs.readFile(job.stagedDataPath, 'utf8');
        rows = JSON.parse(jsonData);
      } else {
        throw new Error('No staged data found');
      }

      await this.updateJobStatus('running');
      await this.log('info', `Committing ${rows.length} rows to database`);

      // Insert to database
      await this.insertToDatabase(job.assignment, rows);

      // Clean up staged data
      if (job.stagedDataPath) {
        try {
          await fs.unlink(job.stagedDataPath);
        } catch {
          // Ignore cleanup errors
        }
      }

      await this.updateJob({
        status: 'completed',
        stagedDataJson: null,
        stagedDataPath: null,
        completedAt: new Date(),
      });

      await this.log('info', 'Commit completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJob({
        status: 'failed',
        errorMessage,
        errorDetails: error instanceof Error ? error.stack : undefined,
      });
      await this.log('error', `Commit failed: ${errorMessage}`);
      throw error;
    } finally {
      if (this.dbConnector) {
        await this.dbConnector.disconnect();
      }
    }
  }

  /**
   * Insert rows to the target database
   */
  private async insertToDatabase(
    assignment: {
      targetTable: string;
      targetSchema: string;
      dataSource: {
        dbType: string;
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        sslEnabled: boolean;
      };
      extractionRules: {
        targetColumn: string;
      }[];
    },
    rows: Record<string, unknown>[]
  ): Promise<void> {
    if (rows.length === 0) {
      await this.log('info', 'No rows to insert');
      return;
    }

    // Get password (decrypt if needed)
    let password = assignment.dataSource.password;
    if (isEncrypted(password)) {
      password = decrypt(password);
    }

    // Create database connector
    this.dbConnector = createConnector({
      dbType: assignment.dataSource.dbType as 'postgresql' | 'mysql' | 'mssql',
      host: assignment.dataSource.host,
      port: assignment.dataSource.port,
      database: assignment.dataSource.database,
      username: assignment.dataSource.username,
      password,
      sslEnabled: assignment.dataSource.sslEnabled,
    });

    await this.dbConnector.connect();

    // Get column names from extraction rules
    const columns = assignment.extractionRules.map(r => r.targetColumn);
    
    let rowsInserted = 0;
    let rowsFailed = 0;

    // Insert rows in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        try {
          // Build INSERT query
          const values = columns.map(col => row[col]);
          const placeholders = this.getPlaceholders(assignment.dataSource.dbType, columns.length);
          
          const sql = `INSERT INTO ${assignment.targetSchema}.${assignment.targetTable} 
            (${columns.map(c => `"${c}"`).join(', ')}) 
            VALUES (${placeholders})`;

          await this.dbConnector.query(sql, values);
          rowsInserted++;
        } catch (error) {
          rowsFailed++;
          await this.log('warn', `Failed to insert row: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update progress
      await this.updateJob({ rowsInserted, rowsFailed });
    }

    await this.log('info', `Inserted ${rowsInserted} rows, ${rowsFailed} failed`);
  }

  /**
   * Get placeholder syntax for different database types
   */
  private getPlaceholders(dbType: string, count: number): string {
    switch (dbType) {
      case 'postgresql':
        return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ');
      case 'mysql':
        return Array(count).fill('?').join(', ');
      case 'mssql':
        return Array.from({ length: count }, (_, i) => `@param${i}`).join(', ');
      default:
        return Array(count).fill('?').join(', ');
    }
  }

  /**
   * Get URLs to scrape based on assignment configuration
   */
  private async getUrlsToScrape(assignment: {
    startUrl?: string | null;
    webSource: {
      baseUrl: string;
      paginationType?: string | null;
      paginationConfig?: string | null;
    };
  }): Promise<string[]> {
    const startUrl = assignment.startUrl || assignment.webSource.baseUrl;
    
    // If no pagination configured, just return the start URL
    if (!assignment.webSource.paginationType || assignment.webSource.paginationType === 'none') {
      return [startUrl];
    }

    // Parse pagination config
    let paginationConfig: PaginationConfig | null = null;
    if (assignment.webSource.paginationConfig) {
      try {
        paginationConfig = JSON.parse(assignment.webSource.paginationConfig);
      } catch {
        // Invalid config
      }
    }

    if (!paginationConfig) {
      return [startUrl];
    }

    // Generate paginated URLs
    return this.scraper!.generatePaginatedUrls(
      startUrl,
      paginationConfig,
      paginationConfig.maxPages
    );
  }

  /**
   * Update job status
   */
  private async updateJobStatus(status: string): Promise<void> {
    if (!this.jobId) return;

    const data: { status: string; startedAt?: Date; completedAt?: Date } = { status };
    
    if (status === 'running') {
      data.startedAt = new Date();
    }
    if (['completed', 'failed', 'cancelled'].includes(status)) {
      data.completedAt = new Date();
    }

    await prisma.extractionJob.update({
      where: { id: this.jobId },
      data,
    });
  }

  /**
   * Update job with partial data
   */
  private async updateJob(data: Record<string, unknown>): Promise<void> {
    if (!this.jobId) return;

    await prisma.extractionJob.update({
      where: { id: this.jobId },
      data: data as any,
    });
  }

  /**
   * Log a message for the job
   */
  private async log(
    level: LogLevel,
    message: string,
    details?: Record<string, unknown>,
    url?: string
  ): Promise<void> {
    if (!this.jobId) return;

    try {
      await prisma.processLog.create({
        data: {
          jobId: this.jobId,
          level,
          message,
          details: details ? JSON.stringify(details) : null,
          url,
        },
      });
    } catch {
      // Log to console if DB logging fails
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Execute extraction for an assignment
 */
export async function executeExtraction(
  assignmentId: string,
  mode: 'manual' | 'auto' = 'manual',
  triggeredBy: 'manual' | 'schedule' | 'api' = 'manual'
): Promise<string> {
  const executor = new ExtractionExecutor();
  return executor.runExtraction(assignmentId, mode, triggeredBy);
}

/**
 * Commit staged data to database
 */
export async function commitStagedData(jobId: string): Promise<void> {
  const executor = new ExtractionExecutor();
  return executor.commitToDatabase(jobId);
}

/**
 * Get staged data for a job
 */
export async function getStagedData(jobId: string): Promise<{
  rows: Record<string, unknown>[];
  rowCount: number;
}> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  let rows: Record<string, unknown>[] = [];

  if (job.stagedDataJson) {
    rows = JSON.parse(job.stagedDataJson);
  } else if (job.stagedDataPath) {
    const jsonData = await fs.readFile(job.stagedDataPath, 'utf8');
    rows = JSON.parse(jsonData);
  }

  return {
    rows,
    rowCount: rows.length,
  };
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!['pending', 'running', 'staging'].includes(job.status)) {
    throw new Error(`Cannot cancel job with status: ${job.status}`);
  }

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: 'cancelled',
      completedAt: new Date(),
    },
  });

  // Clean up staged data
  if (job.stagedDataPath) {
    try {
      await fs.unlink(job.stagedDataPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run sample extraction (limited to a few rows for testing)
 */
export async function runSampleExtraction(
  assignmentId: string,
  maxRows: number = 5
): Promise<{
  rows: Record<string, unknown>[];
  success: boolean;
  error?: string;
}> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      webSource: true,
      extractionRules: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!assignment || !assignment.webSource) {
    return { rows: [], success: false, error: 'Assignment not found' };
  }

  const isLLMMode = assignment.extractionMethod === 'llm';

  if (!isLLMMode && assignment.extractionRules.length === 0) {
    return { rows: [], success: false, error: 'No extraction rules configured' };
  }

  if (isLLMMode && !assignment.llmCaptureConfig) {
    return { rows: [], success: false, error: 'LLM mode requires a structured capture configuration' };
  }

  const scraper = createScraperFromWebSource(assignment.webSource);

  try {
    const url = assignment.startUrl || assignment.webSource.baseUrl;

    if (isLLMMode) {
      const captureConfig: LLMCaptureConfig = JSON.parse(assignment.llmCaptureConfig!);
      const llmExtractor = new LLMExtractor(captureConfig.model);
      const html = await scraper.fetchHtml(url);
      const rows = await llmExtractor.extractWithStructuredOutput(html, captureConfig, url);

      return {
        rows: rows.slice(0, maxRows),
        success: true,
      };
    } else {
      const data = await scraper.scrapeUrl(
        url,
        assignment.extractionRules as unknown as ExtractionRule[]
      );

      return {
        rows: data.rows.slice(0, maxRows),
        success: true,
      };
    }
  } catch (error) {
    return {
      rows: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await scraper.closeBrowser();
  }
}
