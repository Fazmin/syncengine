import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (assignmentId) where.assignmentId = assignmentId;
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.extractionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          assignment: {
            select: {
              id: true,
              name: true,
              targetTable: true,
              syncMode: true,
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
                }
              }
            }
          },
          _count: {
            select: { processLogs: true }
          }
        }
      }),
      prisma.extractionJob.count({ where })
    ]);
    
    return NextResponse.json({
      jobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Get extraction jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extraction jobs' },
      { status: 500 }
    );
  }
}
