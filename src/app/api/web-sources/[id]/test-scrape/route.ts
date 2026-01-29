import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createScraperFromWebSource } from '@/lib/services/web-scraper';
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

    // Get test parameters from request body
    const body = await request.json().catch(() => ({}));
    const url = body.url || webSource.baseUrl;
    const selectors = body.selectors || [];

    // Decrypt auth config if needed
    let authConfigDecrypted = null;
    if (webSource.authConfig && webSource.authType !== 'none') {
      try {
        authConfigDecrypted = isEncrypted(webSource.authConfig)
          ? decrypt(webSource.authConfig)
          : webSource.authConfig;
      } catch {
        // Ignore auth config errors
      }
    }

    // Create scraper with decrypted config
    const scraperConfig = {
      ...webSource,
      authConfig: authConfigDecrypted,
    };

    const scraper = createScraperFromWebSource(scraperConfig);

    try {
      // Test connection first
      const connectionTest = await scraper.testConnection(url);
      
      if (!connectionTest.success) {
        // Update connection status
        await prisma.webSource.update({
          where: { id },
          data: {
            connectionStatus: 'failed',
            lastTestedAt: new Date(),
          }
        });

        return NextResponse.json({
          success: false,
          error: connectionTest.message,
          statusCode: connectionTest.statusCode,
        });
      }

      // If selectors provided, do a test extraction
      let extractedData = null;
      if (selectors.length > 0) {
        const rules = selectors.map((s: { selector: string; attribute?: string; name?: string }, i: number) => ({
          id: `test-${i}`,
          assignmentId: 'test',
          targetColumn: s.name || `field_${i}`,
          selector: s.selector,
          selectorType: 'css' as const,
          attribute: s.attribute || 'text',
          dataType: 'string' as const,
          isRequired: false,
          isActive: true,
          sortOrder: i,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        const data = await scraper.scrapeUrl(url, rules);
        extractedData = {
          rows: data.rows.slice(0, 10), // Limit to 10 rows for preview
          totalRows: data.rows.length,
        };
      }

      // Update connection status
      await prisma.webSource.update({
        where: { id },
        data: {
          connectionStatus: 'connected',
          lastTestedAt: new Date(),
        }
      });

      // Log the test
      await prisma.auditLog.create({
        data: {
          eventType: 'web_source_tested',
          eventDetails: JSON.stringify({ 
            id, 
            url,
            success: true,
            extractedRows: extractedData?.totalRows || 0
          }),
          resourceType: 'web_source',
          resourceId: id,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        statusCode: connectionTest.statusCode,
        extractedData,
      });
    } finally {
      await scraper.closeBrowser();
    }
  } catch (error) {
    console.error('Test scrape error:', error);
    
    // Update connection status on error
    try {
      const { id } = await params;
      await prisma.webSource.update({
        where: { id },
        data: {
          connectionStatus: 'failed',
          lastTestedAt: new Date(),
        }
      });
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Test scrape failed'
      },
      { status: 500 }
    );
  }
}
