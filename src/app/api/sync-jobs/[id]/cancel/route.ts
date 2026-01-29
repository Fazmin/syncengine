import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const syncJob = await prisma.syncJob.findUnique({
      where: { id }
    });
    
    if (!syncJob) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      );
    }
    
    if (syncJob.status !== 'running' && syncJob.status !== 'pending') {
      return NextResponse.json(
        { error: 'Job is not running or pending' },
        { status: 400 }
      );
    }
    
    const updatedJob = await prisma.syncJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: new Date()
      }
    });
    
    // Log cancellation
    await prisma.auditLog.create({
      data: {
        eventType: 'sync_cancelled',
        eventDetails: JSON.stringify({ jobId: id }),
        resourceType: 'sync_job',
        resourceId: id
      }
    });
    
    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error('Cancel sync job error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel sync job' },
      { status: 500 }
    );
  }
}

