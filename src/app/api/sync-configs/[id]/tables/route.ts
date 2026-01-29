import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const tableConfigs = await prisma.tableConfig.findMany({
      where: { syncConfigId: id },
      include: {
        columnConfigs: true
      },
      orderBy: { sourceTable: 'asc' }
    });
    
    return NextResponse.json(tableConfigs);
  } catch (error) {
    console.error('Get table configs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table configurations' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tables } = body;
    
    if (!Array.isArray(tables)) {
      return NextResponse.json(
        { error: 'Tables must be an array' },
        { status: 400 }
      );
    }
    
    // Verify sync config exists
    const syncConfig = await prisma.syncConfig.findUnique({
      where: { id }
    });
    
    if (!syncConfig) {
      return NextResponse.json(
        { error: 'Sync configuration not found' },
        { status: 404 }
      );
    }
    
    // Process each table configuration
    const results = [];
    
    for (const table of tables) {
      const { sourceSchema, sourceTable, columns, ...tableData } = table;
      
      // Upsert table config
      const tableConfig = await prisma.tableConfig.upsert({
        where: {
          syncConfigId_sourceSchema_sourceTable: {
            syncConfigId: id,
            sourceSchema: sourceSchema || 'public',
            sourceTable
          }
        },
        update: {
          ...tableData,
          isActive: table.isActive ?? true
        },
        create: {
          syncConfigId: id,
          sourceSchema: sourceSchema || 'public',
          sourceTable,
          ...tableData,
          isActive: table.isActive ?? true
        }
      });
      
      // Process columns if provided
      if (columns && Array.isArray(columns)) {
        for (const column of columns) {
          await prisma.columnConfig.upsert({
            where: {
              tableConfigId_sourceColumn: {
                tableConfigId: tableConfig.id,
                sourceColumn: column.sourceColumn
              }
            },
            update: {
              isIncluded: column.isIncluded ?? true,
              maskingType: column.maskingType || 'none',
              maskingConfig: column.maskingConfig,
              targetColumn: column.targetColumn,
              isPrimaryKey: column.isPrimaryKey || false
            },
            create: {
              tableConfigId: tableConfig.id,
              sourceColumn: column.sourceColumn,
              dataType: column.dataType,
              isIncluded: column.isIncluded ?? true,
              maskingType: column.maskingType || 'none',
              maskingConfig: column.maskingConfig,
              targetColumn: column.targetColumn,
              isPrimaryKey: column.isPrimaryKey || false
            }
          });
        }
      }
      
      results.push(tableConfig);
    }
    
    // Fetch updated configs with columns
    const updatedConfigs = await prisma.tableConfig.findMany({
      where: { syncConfigId: id },
      include: { columnConfigs: true },
      orderBy: { sourceTable: 'asc' }
    });
    
    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'table_configs_updated',
        eventDetails: JSON.stringify({ tablesCount: tables.length }),
        resourceType: 'sync_config',
        resourceId: id,
        dataSourceId: syncConfig.dataSourceId
      }
    });
    
    return NextResponse.json(updatedConfigs);
  } catch (error) {
    console.error('Update table configs error:', error);
    return NextResponse.json(
      { error: 'Failed to update table configurations' },
      { status: 500 }
    );
  }
}

