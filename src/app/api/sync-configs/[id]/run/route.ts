import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { triggerImmediateSync } from '@/lib/services/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get sync configuration
    const syncConfig = await prisma.syncConfig.findUnique({
      where: { id },
      include: {
        dataSource: true,
        tableConfigs: {
          where: { isActive: true },
        },
      },
    });

    if (!syncConfig) {
      return NextResponse.json(
        { error: 'Sync configuration not found' },
        { status: 404 }
      );
    }

    if (!syncConfig.isActive) {
      return NextResponse.json(
        { error: 'Sync configuration is disabled' },
        { status: 400 }
      );
    }

    if (!syncConfig.dataSource) {
      return NextResponse.json(
        { error: 'Data source not found' },
        { status: 400 }
      );
    }

    if (syncConfig.tableConfigs.length === 0) {
      return NextResponse.json(
        { error: 'No tables configured for sync' },
        { status: 400 }
      );
    }

    // Check for existing running jobs
    const runningJob = await prisma.syncJob.findFirst({
      where: {
        syncConfigId: id,
        status: 'running',
      },
    });

    if (runningJob) {
      return NextResponse.json(
        { error: 'A sync job is already running for this configuration' },
        { status: 409 }
      );
    }

    // Trigger the sync
    const jobId = await triggerImmediateSync(id);

    // Get the created job
    const syncJob = await prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    return NextResponse.json(syncJob, { status: 201 });
  } catch (error) {
    console.error('Trigger sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
