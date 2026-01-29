'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileJson,
  Database,
  Download,
  Ban,
} from 'lucide-react';
import Link from 'next/link';
import { getExtractionJob, getStagedData, commitExtractionJob, cancelExtractionJob } from '@/lib/api';
import type { ExtractionJob, ProcessLog } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pending: { icon: Clock, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Pending' },
  running: { icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Running' },
  staging: { icon: FileJson, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Staging' },
  completed: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Completed' },
  failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' },
  cancelled: { icon: AlertCircle, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Cancelled' },
};

type JobWithRelations = ExtractionJob & {
  duration?: number;
  hasStagedData?: boolean;
  assignment?: {
    id: string;
    name: string;
    targetTable: string;
    targetSchema: string;
    syncMode: string;
    startUrl?: string;
    webSource?: { id: string; name: string; baseUrl: string };
    dataSource?: { id: string; name: string; dbType: string; database: string };
  };
  processLogs?: ProcessLog[];
  _count?: { processLogs: number };
};

export default function ExtractionJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<JobWithRelations | null>(null);
  const [stagedData, setStagedData] = useState<{ rows: Record<string, unknown>[]; columns: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [id]);

  async function fetchJob() {
    const response = await getExtractionJob(id);
    if (response.success && response.data) {
      setJob(response.data);
      
      // Fetch staged data if job is in staging status
      if (response.data.status === 'staging' && response.data.hasStagedData) {
        const stagedResponse = await getStagedData(id, 1, 100);
        if (stagedResponse.success && stagedResponse.data) {
          setStagedData({
            rows: stagedResponse.data.rows,
            columns: stagedResponse.data.columns,
          });
        }
      }
    } else {
      toast.error('Failed to load job');
      router.push('/extraction-jobs');
    }
    setIsLoading(false);
  }

  async function handleCommit() {
    setIsCommitting(true);
    const response = await commitExtractionJob(id);
    
    if (response.success && response.data) {
      toast.success(`Committed ${response.data.rowsInserted} rows to database`);
      fetchJob(); // Refresh job data
    } else {
      toast.error(response.error || 'Failed to commit data');
    }
    
    setIsCommitting(false);
    setShowCommitDialog(false);
  }

  async function handleCancel() {
    setIsCancelling(true);
    const response = await cancelExtractionJob(id);
    
    if (response.success) {
      toast.success('Job cancelled');
      fetchJob();
    } else {
      toast.error(response.error || 'Failed to cancel job');
    }
    
    setIsCancelling(false);
  }

  if (isLoading) {
    return (
      <>
        <Header title="Extraction Job" />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  if (!job) return null;

  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <>
      <Header
        title="Extraction Job"
        description={`Job ${id.slice(0, 8)}...`}
        actions={
          <div className="flex gap-2">
            {job.status === 'staging' && (
              <Button onClick={() => setShowCommitDialog(true)} disabled={isCommitting}>
                {isCommitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Commit to Database
              </Button>
            )}
            {['pending', 'running', 'staging'].includes(job.status) && (
              <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
                {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                Cancel
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/extraction-jobs">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={`gap-1 text-sm ${status.className}`}>
                    <StatusIcon className={`h-4 w-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                    {status.label}
                  </Badge>
                  <Badge variant="outline">
                    {job.syncMode === 'manual' ? 'Manual Mode' : 'Auto Mode'}
                  </Badge>
                </div>
                {job.triggeredBy && (
                  <span className="text-sm text-muted-foreground">
                    Triggered: {job.triggeredBy}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Pages Processed</p>
                  <p className="text-2xl font-bold">{job.pagesProcessed}{job.pagesTotal ? ` / ${job.pagesTotal}` : ''}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rows Extracted</p>
                  <p className="text-2xl font-bold">{job.rowsExtracted}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rows Inserted</p>
                  <p className="text-2xl font-bold text-emerald-500">{job.rowsInserted}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">{job.duration ? `${job.duration}s` : '-'}</p>
                </div>
              </div>
              
              {job.errorMessage && (
                <div className="mt-4 rounded-lg bg-red-500/10 p-4 border border-red-500/20">
                  <p className="text-sm font-medium text-red-400">Error</p>
                  <p className="text-sm text-red-300 mt-1">{job.errorMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment Info */}
          {job.assignment && (
            <Card>
              <CardHeader>
                <CardTitle>Assignment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Assignment</p>
                    <Link href={`/assignments/${job.assignment.id}`} className="text-primary hover:underline">
                      {job.assignment.name}
                    </Link>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Target Table</p>
                    <p>{job.assignment.targetSchema}.{job.assignment.targetTable}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Web Source</p>
                    <p>{job.assignment.webSource?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Database</p>
                    <p>{job.assignment.dataSource?.name} ({job.assignment.dataSource?.dbType})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staged Data Preview */}
          {job.status === 'staging' && stagedData && stagedData.rows.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-purple-400" />
                      Staged Data Preview
                    </CardTitle>
                    <CardDescription>
                      {job.stagedRowCount} rows ready to commit
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {stagedData.columns.map(col => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stagedData.rows.map((row, i) => (
                        <TableRow key={i}>
                          {stagedData.columns.map(col => (
                            <TableCell key={col} className="max-w-[200px] truncate">
                              {String(row[col] ?? '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {stagedData.rows.length < (job.stagedRowCount || 0) && (
                  <p className="mt-2 text-sm text-muted-foreground text-center">
                    Showing {stagedData.rows.length} of {job.stagedRowCount} rows
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Process Logs */}
          {job.processLogs && job.processLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Process Logs</CardTitle>
                <CardDescription>Recent log entries</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {job.processLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`rounded-md border p-3 text-sm ${
                          log.level === 'error' ? 'border-red-500/30 bg-red-500/5' :
                          log.level === 'warn' ? 'border-amber-500/30 bg-amber-500/5' :
                          'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className={
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            log.level === 'info' ? 'text-blue-400' :
                            'text-muted-foreground'
                          }>
                            {log.level}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                          </span>
                        </div>
                        <p>{log.message}</p>
                        {log.url && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            URL: {log.url}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Commit Confirmation Dialog */}
      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit Data to Database</AlertDialogTitle>
            <AlertDialogDescription>
              This will insert {job.stagedRowCount} rows into{' '}
              <strong>{job.assignment?.targetSchema}.{job.assignment?.targetTable}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCommit} disabled={isCommitting}>
              {isCommitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Commit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
