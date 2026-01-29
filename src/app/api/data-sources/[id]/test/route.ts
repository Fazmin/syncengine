import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { testDatabaseConnection } from '@/lib/services/database-connector';

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

    // Test the actual database connection
    const result = await testDatabaseConnection({
      dbType: dataSource.dbType as 'postgresql' | 'mysql' | 'mssql',
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database,
      username: dataSource.username,
      password: dataSource.password,
      sslEnabled: dataSource.sslEnabled,
    });

    // Update connection status in database
    await prisma.dataSource.update({
      where: { id },
      data: {
        connectionStatus: result.success ? 'connected' : 'failed',
        lastTestedAt: new Date(),
      },
    });

    // Log the test
    await prisma.auditLog.create({
      data: {
        eventType: 'connection_tested',
        eventDetails: JSON.stringify({
          result: result.success ? 'success' : 'failed',
          message: result.message,
        }),
        resourceType: 'data_source',
        resourceId: id,
        dataSourceId: id,
      },
    });

    return NextResponse.json({
      status: result.success ? 'connected' : 'failed',
      message: result.message,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    
    // Update status on error
    const { id } = await params;
    await prisma.dataSource.update({
      where: { id },
      data: {
        connectionStatus: 'failed',
        lastTestedAt: new Date(),
      },
    });

    return NextResponse.json({
      status: 'failed',
      message: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
}
