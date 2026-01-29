import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const syncJob = await prisma.syncJob.findUnique({
      where: { id },
      include: {
        syncConfig: {
          include: {
            dataSource: {
              select: {
                id: true,
                name: true,
                dbType: true
              }
            },
            tableConfigs: true
          }
        }
      }
    });
    
    if (!syncJob) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(syncJob);
  } catch (error) {
    console.error('Get sync job error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync job' },
      { status: 500 }
    );
  }
}

