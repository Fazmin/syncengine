import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { commitStagedData } from '@/lib/services/extraction-executor';

export async function POST(
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
        { error: `Cannot commit job with status: ${job.status}. Job must be in 'staging' status.` },
        { status: 400 }
      );
    }

    if (!job.stagedDataJson && !job.stagedDataPath) {
      return NextResponse.json(
        { error: 'No staged data found for this job' },
        { status: 400 }
      );
    }

    // Commit the staged data to the database
    await commitStagedData(id);

    // Log the commit
    await prisma.auditLog.create({
      data: {
        eventType: 'extraction_committed',
        eventDetails: JSON.stringify({
          jobId: id,
          assignmentId: job.assignmentId,
          rowsStaged: job.stagedRowCount,
        }),
        resourceType: 'extraction_job',
        resourceId: id,
      }
    });

    // Get updated job
    const updatedJob = await prisma.extractionJob.findUnique({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Data committed successfully',
      rowsInserted: updatedJob?.rowsInserted || 0,
      rowsFailed: updatedJob?.rowsFailed || 0,
    });
  } catch (error) {
    console.error('Commit extraction job error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to commit staged data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
