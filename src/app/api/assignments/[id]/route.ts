import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { scheduleExtraction, unscheduleExtraction } from '@/lib/services/scheduler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            dbType: true,
            host: true,
            database: true,
            connectionStatus: true,
          }
        },
        webSource: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            scraperType: true,
            paginationType: true,
            connectionStatus: true,
          }
        },
        extractionRules: {
          orderBy: { sortOrder: 'asc' }
        },
        extractionJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { 
            extractionRules: true,
            extractionJobs: true 
          }
        }
      }
    });
    
    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment' },
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
    
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }
    
    const {
      name,
      description,
      targetTable,
      targetSchema,
      syncMode,
      scheduleType,
      cronExpression,
      status,
      startUrl,
      mappingConfig
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (targetTable !== undefined) updateData.targetTable = targetTable;
    if (targetSchema !== undefined) updateData.targetSchema = targetSchema;
    if (syncMode !== undefined) updateData.syncMode = syncMode;
    if (scheduleType !== undefined) updateData.scheduleType = scheduleType;
    if (cronExpression !== undefined) updateData.cronExpression = cronExpression;
    if (status !== undefined) updateData.status = status;
    if (startUrl !== undefined) updateData.startUrl = startUrl;
    if (mappingConfig !== undefined) {
      updateData.mappingConfig = typeof mappingConfig === 'string'
        ? mappingConfig
        : JSON.stringify(mappingConfig);
    }
    
    const assignment = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: {
        dataSource: { select: { id: true, name: true } },
        webSource: { select: { id: true, name: true, baseUrl: true } }
      }
    });

    // Update scheduler based on new status/schedule
    if (status === 'active' && syncMode === 'auto' && scheduleType !== 'manual') {
      scheduleExtraction({
        id: assignment.id,
        name: assignment.name,
        scheduleType: assignment.scheduleType,
        cronExpression: assignment.cronExpression,
        syncMode: assignment.syncMode,
        status: assignment.status,
      });
    } else {
      unscheduleExtraction(id);
    }
    
    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'assignment_updated',
        eventDetails: JSON.stringify({ id, changes: Object.keys(updateData) }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });
    
    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Update assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
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
    
    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: {
        extractionJobs: {
          where: { status: 'running' }
        }
      }
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }
    
    if (existing.extractionJobs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete assignment with running jobs' },
        { status: 400 }
      );
    }

    // Remove from scheduler
    unscheduleExtraction(id);
    
    await prisma.assignment.delete({ where: { id } });
    
    // Log the deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'assignment_deleted',
        eventDetails: JSON.stringify({ id, name: existing.name }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
