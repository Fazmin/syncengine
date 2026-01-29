'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Download,
  Database,
  Table2,
  FileOutput,
  Timer
} from 'lucide-react';
import { getSyncJob, cancelSyncJob, getDownloadUrl } from '@/lib/api';
import type { SyncJob, SyncConfig } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

function JobStatusBadge({ status }: { status: string }) {
  const config = {
    completed: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Completed' },
    running: { icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Running' },
    failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' },
    pending: { icon: Clock, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Pending' },
    cancelled: { icon: XCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Cancelled' },
  }[status] || { icon: AlertCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: status };

  const Icon = config.icon;

  return (
    <Badge className={`gap-1 text-sm px-3 py-1 ${config.className}`}>
      <Icon className={`h-4 w-4 ${status === 'running' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [job, setJob] = useState<SyncJob & { syncConfig?: SyncConfig } | null>(null);

  useEffect(() => {
    fetchJob();
    
    // Poll for updates if job is running
    const interval = setInterval(() => {
      if (job?.status === 'running' || job?.status === 'pending') {
        fetchJob();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [id, job?.status]);

  async function fetchJob() {
    const response = await getSyncJob(id);
    if (response.success && response.data) {
      setJob(response.data);
    } else {
      toast.error('Job not found');
      router.push('/jobs');
    }
    setIsLoading(false);
  }

  async function handleCancel() {
    setIsCancelling(true);
    const response = await cancelSyncJob(id);
    
    if (response.success && response.data) {
      setJob(response.data);
      toast.success('Job cancelled');
    } else {
      toast.error('Failed to cancel job');
    }
    
    setIsCancelling(false);
  }

  if (isLoading) {
    return (
      <>
        <Header title="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-32 w-full" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!job) return null;

  const totalTables = job.syncConfig?.tableConfigs?.length || 0;
  const progress = job.status === 'running' && totalTables > 0
    ? Math.round((job.tablesProcessed / totalTables) * 100)
    : job.status === 'completed' ? 100 : 0;

  return (
    <>
      <Header
        title={`Job ${id.slice(0, 8)}...`}
        description={job.syncConfig?.name}
        actions={
          <div className="flex items-center gap-2">
            {job.status === 'completed' && job.outputFilePath && (
              <Button asChild>
                <a href={getDownloadUrl(job.id)} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
            {(job.status === 'running' || job.status === 'pending') && (
              <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
                {isCancelling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Cancel Job
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/jobs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Status Card */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <JobStatusBadge status={job.status} />
                  <div>
                    <p className="font-medium">
                      {job.syncConfig?.name || 'Unknown Configuration'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Triggered {job.triggeredBy} •{' '}
                      {format(new Date(job.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>
                
                {(job.status === 'running' || job.status === 'pending') && (
                  <div className="w-full sm:w-48">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Table2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{job.tablesProcessed}</p>
                    <p className="text-xs text-muted-foreground">Tables Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Database className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{job.rowsProcessed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Rows Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                    <FileOutput className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {job.outputFileSize ? formatBytes(job.outputFileSize) : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Output Size</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Timer className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {job.startedAt && job.completedAt
                        ? formatDuration(new Date(job.startedAt), new Date(job.completedAt))
                        : job.startedAt
                        ? formatDuration(new Date(job.startedAt), new Date())
                        : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                      <Clock className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(job.createdAt), 'PPpp')}
                      </p>
                    </div>
                  </div>
                  
                  {job.startedAt && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                        <Loader2 className="h-3 w-3 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium">Started</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(job.startedAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {job.completedAt && (
                    <div className="flex items-start gap-3">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        job.status === 'completed' ? 'bg-emerald-500/20' :
                        job.status === 'failed' ? 'bg-red-500/20' :
                        'bg-slate-500/20'
                      }`}>
                        {job.status === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{job.status}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(job.completedAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Configuration Info */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Config Name</dt>
                    <dd className="font-medium">
                      <Link href={`/sync-configs/${job.syncConfigId}`} className="hover:underline">
                        {job.syncConfig?.name}
                      </Link>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Data Source</dt>
                    <dd className="font-medium">{job.syncConfig?.dataSource?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Sync Mode</dt>
                    <dd className="font-medium capitalize">{job.syncConfig?.syncMode}</dd>
                  </div>
                  {job.outputFilePath && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Output Path</dt>
                      <dd className="font-mono text-xs">{job.outputFilePath}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Error Details */}
          {job.status === 'failed' && job.errorMessage && (
            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="text-red-400">Error Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-red-500/10 p-4">
                  <p className="font-medium text-red-400">{job.errorMessage}</p>
                  {job.errorDetails && (
                    <ScrollArea className="mt-4 h-32">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {job.errorDetails}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}

