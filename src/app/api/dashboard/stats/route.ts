import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const [
      totalDataSources,
      activeDataSources,
      totalSyncConfigs,
      activeSyncConfigs,
      totalSyncJobs,
      successfulJobs,
      failedJobs,
      runningJobs,
      recentJobs
    ] = await Promise.all([
      prisma.dataSource.count(),
      prisma.dataSource.count({ where: { isActive: true } }),
      prisma.syncConfig.count(),
      prisma.syncConfig.count({ where: { isActive: true } }),
      prisma.syncJob.count(),
      prisma.syncJob.count({ where: { status: 'completed' } }),
      prisma.syncJob.count({ where: { status: 'failed' } }),
      prisma.syncJob.count({ where: { status: 'running' } }),
      prisma.syncJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { syncConfig: true }
      })
    ]);

    return NextResponse.json({
      totalDataSources,
      activeDataSources,
      totalSyncConfigs,
      activeSyncConfigs,
      totalSyncJobs,
      successfulJobs,
      failedJobs,
      runningJobs,
      recentJobs
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

