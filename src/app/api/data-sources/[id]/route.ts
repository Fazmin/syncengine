import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const dataSource = await prisma.dataSource.findUnique({
      where: { id },
      include: {
        syncConfigs: {
          include: {
            _count: {
              select: { tableConfigs: true, syncJobs: true }
            }
          }
        },
        _count: {
          select: { syncConfigs: true, auditLogs: true }
        }
      }
    });
    
    if (!dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ ...dataSource, password: '********' });
  } catch (error) {
    console.error('Get data source error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data source' },
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
    
    const existing = await prisma.dataSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }
    
    // Don't update password if it's masked
    const updateData: Record<string, unknown> = { ...body };
    if (body.password === '********' || !body.password) {
      delete updateData.password;
    }
    if (body.port) {
      updateData.port = parseInt(body.port);
    }
    
    const dataSource = await prisma.dataSource.update({
      where: { id },
      data: updateData
    });
    
    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'data_source_updated',
        eventDetails: JSON.stringify({ fields: Object.keys(body) }),
        resourceType: 'data_source',
        resourceId: id,
        dataSourceId: id
      }
    });
    
    return NextResponse.json({ ...dataSource, password: '********' });
  } catch (error) {
    console.error('Update data source error:', error);
    return NextResponse.json(
      { error: 'Failed to update data source' },
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
    
    const existing = await prisma.dataSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 404 }
      );
    }
    
    // Log before deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'data_source_deleted',
        eventDetails: JSON.stringify({ name: existing.name }),
        resourceType: 'data_source',
        resourceId: id
      }
    });
    
    await prisma.dataSource.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete data source error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data source' },
      { status: 500 }
    );
  }
}

