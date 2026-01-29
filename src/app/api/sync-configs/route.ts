import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const syncConfigs = await prisma.syncConfig.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            dbType: true,
            connectionStatus: true
          }
        },
        _count: {
          select: { tableConfigs: true, syncJobs: true }
        }
      }
    });
    
    return NextResponse.json(syncConfigs);
  } catch (error) {
    console.error('Get sync configs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      name, 
      description, 
      dataSourceId, 
      syncMode, 
      scheduleType, 
      cronExpression,
      outputPath,
      outputFileName,
      compressOutput,
      encryptOutput
    } = body;
    
    if (!name || !dataSourceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Verify data source exists
    const dataSource = await prisma.dataSource.findUnique({
      where: { id: dataSourceId }
    });
    
    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 400 }
      );
    }
    
    const syncConfig = await prisma.syncConfig.create({
      data: {
        name,
        description,
        dataSourceId,
        syncMode: syncMode || 'full',
        scheduleType: scheduleType || 'manual',
        cronExpression,
        outputPath: outputPath || './output',
        outputFileName: outputFileName || 'sync_data.db',
        compressOutput: compressOutput || false,
        encryptOutput: encryptOutput || false
      },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            dbType: true
          }
        }
      }
    });
    
    // Log the creation
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_config_created',
        eventDetails: JSON.stringify({ name, dataSourceId }),
        resourceType: 'sync_config',
        resourceId: syncConfig.id,
        dataSourceId
      }
    });
    
    return NextResponse.json(syncConfig, { status: 201 });
  } catch (error) {
    console.error('Create sync config error:', error);
    return NextResponse.json(
      { error: 'Failed to create sync configuration' },
      { status: 500 }
    );
  }
}

