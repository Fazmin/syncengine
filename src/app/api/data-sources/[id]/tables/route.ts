import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { discoverTables } from '@/lib/services/database-connector';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const dataSource = await prisma.dataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Discover tables from the actual database
    const tables = await discoverTables({
      dbType: dataSource.dbType as 'postgresql' | 'mysql' | 'mssql',
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database,
      username: dataSource.username,
      password: dataSource.password,
      sslEnabled: dataSource.sslEnabled,
    });

    // Transform to match expected format
    const result = tables.map(table => ({
      schema: table.schema,
      table: table.table,
      columns: table.columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        isPrimaryKey: col.isPrimaryKey,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Discover tables error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover tables' },
      { status: 500 }
    );
  }
}
