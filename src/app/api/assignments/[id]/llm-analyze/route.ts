import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { LLMExtractor } from '@/lib/services/llm-extractor';
import { fetchPageHtml } from '@/lib/services/web-scraper';
import { discoverTables } from '@/lib/services/database-connector';
import { decrypt, isEncrypted } from '@/lib/encryption';
import type { LLMAnalysisResult } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Load assignment with relations
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        dataSource: true,
        webSource: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (!assignment.dataSource || !assignment.webSource) {
      return NextResponse.json(
        { error: 'Assignment is missing data source or web source' },
        { status: 400 }
      );
    }

    // Step 1: Discover target table schema
    let password = assignment.dataSource.password;
    if (isEncrypted(password)) {
      password = decrypt(password);
    }

    const tables = await discoverTables({
      dbType: assignment.dataSource.dbType as 'postgresql' | 'mysql' | 'mssql',
      host: assignment.dataSource.host,
      port: assignment.dataSource.port,
      database: assignment.dataSource.database,
      username: assignment.dataSource.username,
      password,
      sslEnabled: assignment.dataSource.sslEnabled,
    });

    const targetTableInfo = tables.find(
      t => t.table === assignment.targetTable && t.schema === assignment.targetSchema
    );

    if (!targetTableInfo) {
      return NextResponse.json(
        { error: `Target table "${assignment.targetSchema}.${assignment.targetTable}" not found in database` },
        { status: 400 }
      );
    }

    // Step 2: Fetch the web page HTML
    const pageUrl = assignment.startUrl || assignment.webSource.baseUrl;

    let authConfig = undefined;
    if (assignment.webSource.authConfig && assignment.webSource.authType !== 'none') {
      try {
        const decrypted = isEncrypted(assignment.webSource.authConfig)
          ? decrypt(assignment.webSource.authConfig)
          : assignment.webSource.authConfig;
        authConfig = JSON.parse(decrypted);
      } catch {
        // Ignore auth config errors
      }
    }

    const html = await fetchPageHtml(pageUrl, {
      type: assignment.webSource.scraperType as 'browser' | 'http' | 'hybrid',
      baseUrl: assignment.webSource.baseUrl,
      requestDelay: assignment.webSource.requestDelay,
      maxConcurrent: assignment.webSource.maxConcurrent,
      authType: assignment.webSource.authType as 'none' | 'cookie' | 'header' | 'basic',
      authConfig,
    });

    // Step 3: Run LLM analysis
    const targetColumns = targetTableInfo.columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      isPrimaryKey: col.isPrimaryKey,
      defaultValue: col.defaultValue,
    }));

    const extractor = new LLMExtractor();
    const analysis = await extractor.analyzePage(
      html,
      targetColumns,
      assignment.targetTable,
      pageUrl
    );

    // Build result
    const availableColumns = analysis.columns.filter(c => c.isAvailable);

    const result: LLMAnalysisResult = {
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      targetTable: assignment.targetTable,
      targetSchema: assignment.targetSchema,
      dataSourceName: assignment.dataSource.name,
      pageTitle: analysis.pageTitle,
      pageUrl,
      columns: analysis.columns,
      summary: {
        totalColumns: analysis.columns.length,
        availableColumns: availableColumns.length,
        unavailableColumns: analysis.columns
          .filter(c => !c.isAvailable)
          .map(c => c.columnName),
      },
    };

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventType: 'llm_page_analysis',
        eventDetails: JSON.stringify({
          assignmentId: assignment.id,
          targetTable: assignment.targetTable,
          totalColumns: result.summary.totalColumns,
          availableColumns: result.summary.availableColumns,
        }),
        resourceType: 'assignment',
        resourceId: assignment.id,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('LLM analyze error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze page with LLM',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
