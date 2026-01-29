import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dataSourceId = searchParams.get('dataSourceId');
    const webSourceId = searchParams.get('webSourceId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (webSourceId) where.webSourceId = webSourceId;

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            dbType: true,
            connectionStatus: true,
          }
        },
        webSource: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            connectionStatus: true,
          }
        },
        _count: {
          select: { 
            extractionRules: true,
            extractionJobs: true 
          }
        }
      }
    });
    
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
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
      webSourceId, 
      targetTable,
      targetSchema,
      syncMode,
      scheduleType,
      cronExpression,
      startUrl
    } = body;
    
    if (!name || !dataSourceId || !webSourceId || !targetTable) {
      return NextResponse.json(
        { error: 'Name, data source, web source, and target table are required' },
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
        { status: 404 }
      );
    }

    // Verify web source exists
    const webSource = await prisma.webSource.findUnique({ 
      where: { id: webSourceId } 
    });
    if (!webSource) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }
    
    const assignment = await prisma.assignment.create({
      data: {
        name,
        description,
        dataSourceId,
        webSourceId,
        targetTable,
        targetSchema: targetSchema || 'public',
        syncMode: syncMode || 'manual',
        scheduleType: scheduleType || 'manual',
        cronExpression,
        startUrl: startUrl || webSource.baseUrl,
        status: 'draft',
      },
      include: {
        dataSource: {
          select: { id: true, name: true, dbType: true }
        },
        webSource: {
          select: { id: true, name: true, baseUrl: true }
        }
      }
    });
    
    // Log the creation
    await prisma.auditLog.create({
      data: {
        eventType: 'assignment_created',
        eventDetails: JSON.stringify({ 
          name, 
          dataSourceId, 
          webSourceId,
          targetTable 
        }),
        resourceType: 'assignment',
        resourceId: assignment.id,
      }
    });
    
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Create assignment error:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'An assignment for this data source, web source, and target table already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
