import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const syncConfig = await prisma.syncConfig.findUnique({
      where: { id },
      include: {
        dataSource: true,
        tableConfigs: {
          include: {
            columnConfigs: true
          }
        },
        syncJobs: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!syncConfig) {
      return NextResponse.json(
        { error: 'Sync configuration not found' },
        { status: 404 }
      );
    }
    
    // Mask data source password
    return NextResponse.json({
      ...syncConfig,
      dataSource: {
        ...syncConfig.dataSource,
        password: '********'
      }
    });
  } catch (error) {
    console.error('Get sync config error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync configuration' },
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
    
    const existing = await prisma.syncConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Sync configuration not found' },
        { status: 404 }
      );
    }
    
    const syncConfig = await prisma.syncConfig.update({
      where: { id },
      data: body,
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
    
    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_config_updated',
        eventDetails: JSON.stringify({ fields: Object.keys(body) }),
        resourceType: 'sync_config',
        resourceId: id,
        dataSourceId: syncConfig.dataSourceId
      }
    });
    
    return NextResponse.json(syncConfig);
  } catch (error) {
    console.error('Update sync config error:', error);
    return NextResponse.json(
      { error: 'Failed to update sync configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing = await prisma.syncConfig.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Sync configuration not found' },
        { status: 404 }
      );
    }
    
    // Log before deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_config_deleted',
        eventDetails: JSON.stringify({ name: existing.name }),
        resourceType: 'sync_config',
        resourceId: id,
        dataSourceId: existing.dataSourceId
      }
    });
    
    await prisma.syncConfig.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete sync config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete sync configuration' },
      { status: 500 }
    );
  }
}

