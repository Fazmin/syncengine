import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const job = await prisma.extractionJob.findUnique({
      where: { id }
    });
    
    if (!job) {
      return NextResponse.json(
        { error: 'Extraction job not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = { jobId: id };
    if (level) where.level = level;

    const [logs, total] = await Promise.all([
      prisma.processLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.processLog.count({ where })
    ]);
    
    // Get log level counts
    const levelCounts = await prisma.processLog.groupBy({
      by: ['level'],
      where: { jobId: id },
      _count: true,
    });

    const counts = levelCounts.reduce((acc, item) => {
      acc[item.level] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      logs,
      counts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Get job logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
