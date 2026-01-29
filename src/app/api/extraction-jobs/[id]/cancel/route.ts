import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { cancelJob } from '@/lib/services/extraction-executor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const job = await prisma.extractionJob.findUnique({
      where: { id }
    });
    
    if (!job) {
      return NextResponse.json(
        { error: 'Extraction job not found' },
        { status: 404 }
      );
    }

    if (!['pending', 'running', 'staging'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Cancel the job
    await cancelJob(id);

    // Log the cancellation
    await prisma.auditLog.create({
      data: {
        eventType: 'extraction_cancelled',
        eventDetails: JSON.stringify({
          jobId: id,
          assignmentId: job.assignmentId,
          previousStatus: job.status,
        }),
        resourceType: 'extraction_job',
        resourceId: id,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel extraction job error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
