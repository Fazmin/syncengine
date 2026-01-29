import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { analyzeWebsite } from '@/lib/services/web-scraper';
import { decrypt, isEncrypted } from '@/lib/encryption';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const webSource = await prisma.webSource.findUnique({ where: { id } });
    
    if (!webSource) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }

    // Get URL from request body or use base URL
    const body = await request.json().catch(() => ({}));
    const url = body.url || webSource.baseUrl;

    // Prepare auth config if needed
    let authConfig = undefined;
    if (webSource.authConfig && webSource.authType !== 'none') {
      try {
        const decrypted = isEncrypted(webSource.authConfig)
          ? decrypt(webSource.authConfig)
          : webSource.authConfig;
        authConfig = JSON.parse(decrypted);
      } catch {
        // Ignore auth config errors
      }
    }

    // Analyze website structure
    const structure = await analyzeWebsite(url, {
      type: webSource.scraperType as 'browser' | 'http' | 'hybrid',
      baseUrl: webSource.baseUrl,
      requestDelay: webSource.requestDelay,
      maxConcurrent: webSource.maxConcurrent,
      authType: webSource.authType as 'none' | 'cookie' | 'header' | 'basic',
      authConfig,
    });

    // Update web source with analyzed structure
    await prisma.webSource.update({
      where: { id },
      data: {
        structureJson: JSON.stringify(structure),
        paginationType: structure.pagination?.type || null,
        paginationConfig: structure.pagination 
          ? JSON.stringify(structure.pagination) 
          : null,
        lastAnalyzedAt: new Date(),
      }
    });

    // Log the analysis
    await prisma.auditLog.create({
      data: {
        eventType: 'web_source_analyzed',
        eventDetails: JSON.stringify({ 
          id, 
          url,
          repeatingElements: structure.repeatingElements.length,
          hasPagination: !!structure.pagination
        }),
        resourceType: 'web_source',
        resourceId: id,
      }
    });

    return NextResponse.json({
      success: true,
      structure,
    });
  } catch (error) {
    console.error('Analyze web source error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze website',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
