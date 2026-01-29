import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { suggestFieldMappings, mappingsToExtractionRules } from '@/lib/services/ai-mapper';
import { discoverTables } from '@/lib/services/database-connector';
import { analyzeWebsite } from '@/lib/services/web-scraper';
import { decrypt, isEncrypted } from '@/lib/encryption';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        dataSource: true,
        webSource: true,
      }
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

    // Get request body for optional parameters
    const body = await request.json().catch(() => ({}));
    const url = body.url || assignment.startUrl || assignment.webSource.baseUrl;

    // Step 1: Get database tables
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

    // Step 2: Analyze website structure (use cached if available)
    let webStructure;
    if (assignment.webSource.structureJson) {
      try {
        webStructure = JSON.parse(assignment.webSource.structureJson);
      } catch {
        // Re-analyze if cached structure is invalid
        webStructure = null;
      }
    }

    if (!webStructure) {
      webStructure = await analyzeWebsite(url, {
        type: assignment.webSource.scraperType as 'browser' | 'http' | 'hybrid',
        baseUrl: assignment.webSource.baseUrl,
        requestDelay: assignment.webSource.requestDelay,
        maxConcurrent: 1,
        authType: assignment.webSource.authType as 'none' | 'cookie' | 'header' | 'basic',
      });

      // Cache the structure
      await prisma.webSource.update({
        where: { id: assignment.webSourceId },
        data: {
          structureJson: JSON.stringify(webStructure),
          lastAnalyzedAt: new Date(),
        }
      });
    }

    // Step 3: Get AI mapping suggestions
    const suggestions = await suggestFieldMappings(
      tables,
      webStructure,
      assignment.targetTable
    );

    // Step 4: Convert suggestions to extraction rules format
    const proposedRules = mappingsToExtractionRules(suggestions, id);

    // Log the suggestion request
    await prisma.auditLog.create({
      data: {
        eventType: 'mapping_suggested',
        eventDetails: JSON.stringify({
          assignmentId: id,
          suggestionsCount: suggestions.length,
          url
        }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });

    return NextResponse.json({
      success: true,
      suggestions,
      proposedRules,
      webStructure: {
        url: webStructure.url,
        title: webStructure.title,
        repeatingElements: webStructure.repeatingElements,
        pagination: webStructure.pagination,
      },
      availableTables: tables.map(t => ({
        schema: t.schema,
        table: t.table,
        columns: t.columns.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          isPrimaryKey: c.isPrimaryKey,
        }))
      }))
    });
  } catch (error) {
    console.error('Suggest mapping error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate mapping suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
