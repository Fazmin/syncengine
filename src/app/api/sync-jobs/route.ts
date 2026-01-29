import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncConfigId = searchParams.get('syncConfigId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const where: Record<string, unknown> = {};
    if (syncConfigId) where.syncConfigId = syncConfigId;
    if (status) where.status = status;
    
    const syncJobs = await prisma.syncJob.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        syncConfig: {
          select: {
            id: true,
            name: true,
            dataSource: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    return NextResponse.json(syncJobs);
  } catch (error) {
    console.error('Get sync jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync jobs' },
      { status: 500 }
    );
  }
}

