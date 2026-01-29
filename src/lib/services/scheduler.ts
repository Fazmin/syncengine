import cron, { ScheduledTask } from 'node-cron';
import prisma from '../db';
import { executeSync } from './sync-executor';
import { executeExtraction } from './extraction-executor';

// Store active scheduled tasks for sync configs (legacy)
const scheduledSyncTasks = new Map<string, ScheduledTask>();

// Store active scheduled tasks for extraction assignments
const scheduledExtractionTasks = new Map<string, ScheduledTask>();

// Lock to prevent concurrent syncs of the same config
const runningJobs = new Set<string>();

// Lock to prevent concurrent extractions of the same assignment
const runningExtractions = new Set<string>();

// Legacy alias for backward compatibility
const scheduledTasks = scheduledSyncTasks;

/**
 * Get cron expression from schedule type
 */
function getCronExpression(scheduleType: string, cronExpression?: string | null): string | null {
  switch (scheduleType) {
    case 'hourly':
      return '0 * * * *'; // Every hour at minute 0
    case 'daily':
      return '0 0 * * *'; // Every day at midnight
    case 'weekly':
      return '0 0 * * 0'; // Every Sunday at midnight
    case 'cron':
      return cronExpression || null;
    default:
      return null;
  }
}

/**
 * Schedule a sync configuration
 */
export function scheduleSync(config: {
  id: string;
  name: string;
  scheduleType: string;
  cronExpression?: string | null;
  isActive: boolean;
}): boolean {
  // Remove existing schedule if any
  unscheduleSync(config.id);

  // Don't schedule if not active or manual
  if (!config.isActive || config.scheduleType === 'manual') {
    return false;
  }

  const cronExpr = getCronExpression(config.scheduleType, config.cronExpression);
  if (!cronExpr) {
    console.warn(`Invalid schedule for config ${config.name}: ${config.scheduleType}`);
    return false;
  }

  // Validate cron expression
  if (!cron.validate(cronExpr)) {
    console.error(`Invalid cron expression for config ${config.name}: ${cronExpr}`);
    return false;
  }

  // Create scheduled task
  const task = cron.schedule(cronExpr, async () => {
    // Prevent concurrent runs
    if (runningJobs.has(config.id)) {
      console.log(`Skipping scheduled sync for ${config.name} - already running`);
      return;
    }

    console.log(`Starting scheduled sync for ${config.name}`);
    runningJobs.add(config.id);

    try {
      await executeSync(config.id, 'schedule');
      console.log(`Completed scheduled sync for ${config.name}`);
    } catch (error) {
      console.error(`Failed scheduled sync for ${config.name}:`, error);
    } finally {
      runningJobs.delete(config.id);
    }
  });

  scheduledTasks.set(config.id, task);
  console.log(`Scheduled sync for ${config.name} with cron: ${cronExpr}`);
  return true;
}

/**
 * Remove a scheduled sync
 */
export function unscheduleSync(configId: string): void {
  const task = scheduledTasks.get(configId);
  if (task) {
    task.stop();
    scheduledTasks.delete(configId);
    console.log(`Unscheduled sync for config ${configId}`);
  }
}

/**
 * Schedule an extraction assignment (SyncEngine)
 */
export function scheduleExtraction(assignment: {
  id: string;
  name: string;
  scheduleType: string;
  cronExpression?: string | null;
  syncMode: string;
  status: string;
}): boolean {
  // Remove existing schedule if any
  unscheduleExtraction(assignment.id);

  // Don't schedule if not active, not auto mode, or manual schedule
  if (assignment.status !== 'active' || 
      assignment.syncMode !== 'auto' || 
      assignment.scheduleType === 'manual') {
    return false;
  }

  const cronExpr = getCronExpression(assignment.scheduleType, assignment.cronExpression);
  if (!cronExpr) {
    console.warn(`Invalid schedule for assignment ${assignment.name}: ${assignment.scheduleType}`);
    return false;
  }

  // Validate cron expression
  if (!cron.validate(cronExpr)) {
    console.error(`Invalid cron expression for assignment ${assignment.name}: ${cronExpr}`);
    return false;
  }

  // Create scheduled task
  const task = cron.schedule(cronExpr, async () => {
    // Prevent concurrent runs
    if (runningExtractions.has(assignment.id)) {
      console.log(`Skipping scheduled extraction for ${assignment.name} - already running`);
      return;
    }

    console.log(`Starting scheduled extraction for ${assignment.name}`);
    runningExtractions.add(assignment.id);

    try {
      await executeExtraction(assignment.id, 'auto', 'schedule');
      console.log(`Completed scheduled extraction for ${assignment.name}`);
    } catch (error) {
      console.error(`Failed scheduled extraction for ${assignment.name}:`, error);
    } finally {
      runningExtractions.delete(assignment.id);
    }
  });

  scheduledExtractionTasks.set(assignment.id, task);
  console.log(`Scheduled extraction for ${assignment.name} with cron: ${cronExpr}`);
  return true;
}

/**
 * Remove a scheduled extraction
 */
export function unscheduleExtraction(assignmentId: string): void {
  const task = scheduledExtractionTasks.get(assignmentId);
  if (task) {
    task.stop();
    scheduledExtractionTasks.delete(assignmentId);
    console.log(`Unscheduled extraction for assignment ${assignmentId}`);
  }
}

/**
 * Trigger immediate extraction for an assignment
 */
export async function triggerImmediateExtraction(
  assignmentId: string,
  mode: 'manual' | 'auto' = 'manual'
): Promise<string> {
  // Prevent concurrent runs
  if (runningExtractions.has(assignmentId)) {
    throw new Error('An extraction job is already running for this assignment');
  }

  runningExtractions.add(assignmentId);

  try {
    const jobId = await executeExtraction(assignmentId, mode, 'manual');
    return jobId;
  } finally {
    runningExtractions.delete(assignmentId);
  }
}

/**
 * Initialize all scheduled syncs and extractions from database
 */
export async function initializeScheduler(): Promise<void> {
  console.log('Initializing SyncEngine scheduler...');

  try {
    // Initialize legacy sync configs
    const syncConfigs = await prisma.syncConfig.findMany({
      where: {
        isActive: true,
        scheduleType: { not: 'manual' },
      },
      select: {
        id: true,
        name: true,
        scheduleType: true,
        cronExpression: true,
        isActive: true,
      },
    });

    let syncScheduledCount = 0;
    for (const config of syncConfigs) {
      if (scheduleSync(config)) {
        syncScheduledCount++;
      }
    }

    // Initialize extraction assignments
    const assignments = await prisma.assignment.findMany({
      where: {
        status: 'active',
        syncMode: 'auto',
        scheduleType: { not: 'manual' },
      },
      select: {
        id: true,
        name: true,
        scheduleType: true,
        cronExpression: true,
        syncMode: true,
        status: true,
      },
    });

    let extractionScheduledCount = 0;
    for (const assignment of assignments) {
      if (scheduleExtraction(assignment)) {
        extractionScheduledCount++;
      }
    }

    console.log(`Scheduler initialized with ${syncScheduledCount} sync configs and ${extractionScheduledCount} extraction assignments`);
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
  }
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler(): void {
  console.log('Stopping SyncEngine scheduler...');
  
  // Stop sync tasks
  for (const [configId, task] of scheduledSyncTasks) {
    task.stop();
  }
  scheduledSyncTasks.clear();

  // Stop extraction tasks
  for (const [assignmentId, task] of scheduledExtractionTasks) {
    task.stop();
  }
  scheduledExtractionTasks.clear();
  
  console.log('Scheduler stopped');
}

/**
 * Get status of all scheduled tasks
 */
export function getSchedulerStatus(): {
  totalScheduled: number;
  runningJobs: string[];
  runningExtractions: string[];
  syncSchedules: { configId: string; running: boolean }[];
  extractionSchedules: { assignmentId: string; running: boolean }[];
} {
  return {
    totalScheduled: scheduledSyncTasks.size + scheduledExtractionTasks.size,
    runningJobs: Array.from(runningJobs),
    runningExtractions: Array.from(runningExtractions),
    syncSchedules: Array.from(scheduledSyncTasks.keys()).map(configId => ({
      configId,
      running: runningJobs.has(configId),
    })),
    extractionSchedules: Array.from(scheduledExtractionTasks.keys()).map(assignmentId => ({
      assignmentId,
      running: runningExtractions.has(assignmentId),
    })),
  };
}

/**
 * Trigger immediate sync for a config
 */
export async function triggerImmediateSync(configId: string): Promise<string> {
  // Prevent concurrent runs
  if (runningJobs.has(configId)) {
    throw new Error('A sync job is already running for this configuration');
  }

  runningJobs.add(configId);

  try {
    const jobId = await executeSync(configId, 'manual');
    return jobId;
  } finally {
    runningJobs.delete(configId);
  }
}

