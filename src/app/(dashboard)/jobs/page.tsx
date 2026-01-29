'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileOutput,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { getSyncJobs, cancelSyncJob, getDownloadUrl } from '@/lib/api';
import type { SyncJob } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

function JobStatusBadge({ status }: { status: string }) {
  const config = {
    completed: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    running: { icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    pending: { icon: Clock, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    cancelled: { icon: XCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  }[status] || { icon: AlertCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

  const Icon = config.icon;

  return (
    <Badge className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
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
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobs() {
    const response = await getSyncJobs();
    if (response.success && response.data) {
      setJobs(response.data);
    }
    setIsLoading(false);
  }

  async function handleCancel(jobId: string) {
    setCancellingId(jobId);
    const response = await cancelSyncJob(jobId);
    
    if (response.success) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: 'cancelled', completedAt: new Date() } : j
        )
      );
      toast.success('Job cancelled');
    } else {
      toast.error('Failed to cancel job');
    }
    
    setCancellingId(null);
  }

  const filteredJobs = statusFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.status === statusFilter);

  return (
    <>
      <Header
        title="Sync Jobs"
        description="Monitor synchronization job executions"
        actions={
          <Button variant="outline" onClick={fetchJobs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Job History</CardTitle>
                <CardDescription>
                  {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileOutput className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">No jobs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Configuration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sync-configs/${job.syncConfigId}`}
                          className="font-medium hover:underline"
                        >
                          {job.syncConfig?.name || 'Unknown'}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {job.syncConfig?.dataSource?.name}
                        </p>
                      </TableCell>
                      <TableCell>
                        {job.startedAt ? (
                          <div>
                            <p className="text-sm">
                              {format(new Date(job.startedAt), 'MMM d, HH:mm')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.startedAt && job.completedAt ? (
                          formatDuration(new Date(job.startedAt), new Date(job.completedAt))
                        ) : job.status === 'running' && job.startedAt ? (
                          <span className="text-blue-400">
                            {formatDuration(new Date(job.startedAt), new Date())}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.rowsProcessed > 0 ? (
                          job.rowsProcessed.toLocaleString()
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.outputFileSize ? (
                          formatBytes(job.outputFileSize)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {job.status === 'completed' && job.outputFilePath && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={getDownloadUrl(job.id)} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {(job.status === 'running' || job.status === 'pending') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(job.id)}
                              disabled={cancellingId === job.id}
                            >
                              {cancellingId === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Cancel'
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/jobs/${job.id}`}>Details</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

