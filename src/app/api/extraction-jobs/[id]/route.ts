import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const job = await prisma.extractionJob.findUnique({
      where: { id },
      include: {
        assignment: {
          select: {
            id: true,
            name: true,
            targetTable: true,
            targetSchema: true,
            syncMode: true,
            startUrl: true,
            webSource: {
              select: {
                id: true,
                name: true,
                baseUrl: true,
              }
            },
            dataSource: {
              select: {
                id: true,
                name: true,
                dbType: true,
                database: true,
              }
            }
          }
        },
        processLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100
        },
        _count: {
          select: { processLogs: true }
        }
      }
    });
    
    if (!job) {
      return NextResponse.json(
        { error: 'Extraction job not found' },
        { status: 404 }
      );
    }
    
    // Calculate duration if job has timing info
    let duration = null;
    if (job.startedAt) {
      const endTime = job.completedAt || new Date();
      duration = Math.round((endTime.getTime() - job.startedAt.getTime()) / 1000);
    }
    
    return NextResponse.json({
      ...job,
      duration,
      hasStagedData: !!(job.stagedDataJson || job.stagedDataPath)
    });
  } catch (error) {
    console.error('Get extraction job error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extraction job' },
      { status: 500 }
    );
  }
}
