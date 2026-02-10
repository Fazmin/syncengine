import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { LLMExtractor } from '@/lib/services/llm-extractor';
import { fetchPageHtml } from '@/lib/services/web-scraper';
import { decrypt, isEncrypted } from '@/lib/encryption';
import type { LLMColumnAnalysis } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { columns: analysisColumns } = body as { columns?: LLMColumnAnalysis[] };

    if (!analysisColumns || !Array.isArray(analysisColumns)) {
      return NextResponse.json(
        { error: 'columns array from LLM analysis is required' },
        { status: 400 }
      );
    }

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

    if (!assignment.webSource) {
      return NextResponse.json(
        { error: 'Assignment is missing web source' },
        { status: 400 }
      );
    }

    // Fetch HTML for context
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

    // Generate structured capture config
    const extractor = new LLMExtractor();
    const captureConfig = await extractor.createCaptureConfig(
      analysisColumns,
      assignment.targetTable,
      pageUrl,
      html
    );

    // Save to assignment
    await prisma.assignment.update({
      where: { id },
      data: {
        extractionMethod: 'llm',
        llmCaptureConfig: JSON.stringify(captureConfig),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventType: 'llm_capture_created',
        eventDetails: JSON.stringify({
          assignmentId: assignment.id,
          targetTable: assignment.targetTable,
          columnCount: captureConfig.columnMappings.length,
          model: captureConfig.model,
        }),
        resourceType: 'assignment',
        resourceId: assignment.id,
      },
    });

    return NextResponse.json({
      success: true,
      captureConfig,
      message: `Structured capture created with ${captureConfig.columnMappings.length} columns`,
    });
  } catch (error) {
    console.error('LLM create capture error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create structured capture',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
