import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getStagedData } from '@/lib/services/extraction-executor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    
    const job = await prisma.extractionJob.findUnique({
      where: { id },
      include: {
        assignment: {
          select: {
            extractionRules: {
              select: { targetColumn: true },
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
    
    if (!job) {
      return NextResponse.json(
        { error: 'Extraction job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'staging') {
      return NextResponse.json(
        { error: 'Job is not in staging status' },
        { status: 400 }
      );
    }

    if (!job.stagedDataJson && !job.stagedDataPath) {
      return NextResponse.json(
        { error: 'No staged data found' },
        { status: 404 }
      );
    }

    // Get staged data
    const { rows, rowCount } = await getStagedData(id);

    // Paginate the data
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRows = rows.slice(startIndex, endIndex);

    // Get column names from extraction rules
    const columns = job.assignment?.extractionRules.map(r => r.targetColumn) || 
      (paginatedRows.length > 0 ? Object.keys(paginatedRows[0]) : []);

    return NextResponse.json({
      rows: paginatedRows,
      columns,
      pagination: {
        page,
        pageSize,
        totalRows: rowCount,
        totalPages: Math.ceil(rowCount / pageSize),
        hasMore: endIndex < rowCount
      }
    });
  } catch (error) {
    console.error('Get staged data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staged data' },
      { status: 500 }
    );
  }
}
