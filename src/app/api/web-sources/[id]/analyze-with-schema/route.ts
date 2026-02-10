import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { suggestFieldMappings } from '@/lib/services/ai-mapper';
import { discoverTables } from '@/lib/services/database-connector';
import { analyzeWebsite } from '@/lib/services/web-scraper';
import { decrypt, isEncrypted } from '@/lib/encryption';
import type { SchemaAwareAnalysis, ProposedMapping } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { assignmentId } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    // Load web source
    const webSource = await prisma.webSource.findUnique({ where: { id } });
    if (!webSource) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }

    // Load assignment with relations
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
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

    if (assignment.webSourceId !== id) {
      return NextResponse.json(
        { error: 'Assignment does not belong to this web source' },
        { status: 400 }
      );
    }

    if (!assignment.dataSource) {
      return NextResponse.json(
        { error: 'Assignment is missing its data source' },
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

    // Step 2: Analyze website structure (use cached if available)
    let webStructure;
    if (webSource.structureJson) {
      try {
        webStructure = JSON.parse(webSource.structureJson);
      } catch {
        webStructure = null;
      }
    }

    if (!webStructure) {
      // Prepare auth config
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

      webStructure = await analyzeWebsite(webSource.baseUrl, {
        type: webSource.scraperType as 'browser' | 'http' | 'hybrid',
        baseUrl: webSource.baseUrl,
        requestDelay: webSource.requestDelay,
        maxConcurrent: webSource.maxConcurrent,
        authType: webSource.authType as 'none' | 'cookie' | 'header' | 'basic',
        authConfig,
      });

      // Cache the structure
      await prisma.webSource.update({
        where: { id },
        data: {
          structureJson: JSON.stringify(webStructure),
          paginationType: webStructure.pagination?.type || null,
          paginationConfig: webStructure.pagination
            ? JSON.stringify(webStructure.pagination)
            : null,
          lastAnalyzedAt: new Date(),
        },
      });
    }

    // Step 3: Get AI mapping suggestions
    const suggestions = await suggestFieldMappings(
      tables,
      webStructure,
      assignment.targetTable
    );

    // Step 4: Build ProposedMapping[] for every target column
    const targetColumns = targetTableInfo.columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      isPrimaryKey: col.isPrimaryKey,
      defaultValue: col.defaultValue,
    }));

    const proposedMappings: ProposedMapping[] = targetColumns.map(dbColumn => {
      const suggestion = suggestions.find(s => s.dbColumn.name === dbColumn.name);

      if (suggestion) {
        return {
          targetColumn: dbColumn.name,
          dbColumn,
          webField: suggestion.webField,
          selector: suggestion.selector,
          selectorType: 'css' as const,
          attribute: suggestion.webField?.attribute || 'text',
          transformType: suggestion.transformType,
          transformConfig: suggestion.transformConfig,
          confidence: suggestion.confidence,
          sampleValue: suggestion.webField?.sampleValue,
          dataType: suggestion.webField?.dataType || 'string',
          isRequired: !dbColumn.nullable && !dbColumn.isPrimaryKey,
        };
      }

      // Unmapped column
      return {
        targetColumn: dbColumn.name,
        dbColumn,
        selector: '',
        selectorType: 'css' as const,
        attribute: 'text' as const,
        confidence: 0,
        dataType: 'string' as const,
        isRequired: !dbColumn.nullable && !dbColumn.isPrimaryKey,
      };
    });

    // Step 5: Compute summary
    const mappedMappings = proposedMappings.filter(m => m.confidence > 0);
    const unmappedColumns = proposedMappings
      .filter(m => m.confidence === 0)
      .map(m => m.targetColumn);
    const averageConfidence = mappedMappings.length > 0
      ? mappedMappings.reduce((sum, m) => sum + m.confidence, 0) / mappedMappings.length
      : 0;

    const result: SchemaAwareAnalysis = {
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      targetTable: assignment.targetTable,
      targetSchema: assignment.targetSchema,
      dataSourceName: assignment.dataSource.name,
      webStructure,
      targetColumns,
      proposedMappings,
      summary: {
        totalColumns: targetColumns.length,
        mappedColumns: mappedMappings.length,
        unmappedColumns,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
      },
    };

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventType: 'web_source_schema_analyzed',
        eventDetails: JSON.stringify({
          webSourceId: id,
          assignmentId: assignment.id,
          targetTable: assignment.targetTable,
          totalColumns: targetColumns.length,
          mappedColumns: mappedMappings.length,
        }),
        resourceType: 'web_source',
        resourceId: id,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Schema-aware analyze error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze with schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
