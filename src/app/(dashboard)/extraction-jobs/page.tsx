'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileJson,
  Eye,
} from 'lucide-react';
import { getExtractionJobs } from '@/lib/api';
import type { ExtractionJob } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pending: { icon: Clock, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Pending' },
  running: { icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Running' },
  staging: { icon: FileJson, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Staging' },
  completed: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Completed' },
  failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' },
  cancelled: { icon: AlertCircle, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Cancelled' },
};

type JobWithRelations = ExtractionJob & {
  assignment?: {
    id: string;
    name: string;
    targetTable: string;
    syncMode: string;
    webSource?: { id: string; name: string; baseUrl: string };
    dataSource?: { id: string; name: string; dbType: string };
  };
  _count?: { processLogs: number };
};

export default function ExtractionJobsPage() {
  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const response = await getExtractionJobs({ limit: 50 });
    if (response.success && response.data) {
      setJobs(response.data.jobs);
    }
    setIsLoading(false);
  }

  return (
    <>
      <Header
        title="Extraction Jobs"
        description="View and manage extraction job history"
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-600/10">
                <Play className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No extraction jobs yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Run an extraction from an assignment to see jobs here
              </p>
              <Button asChild className="mt-6">
                <Link href="/assignments">
                  Go to Assignments
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>{jobs.length} extraction jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const status = statusConfig[job.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    
                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Badge className={`gap-1 ${status.className}`}>
                            <StatusIcon className={`h-3 w-3 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{job.assignment?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.assignment?.targetTable}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {job.syncMode === 'manual' ? 'Manual' : 'Auto'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{job.rowsExtracted} rows extracted</p>
                            {job.syncMode === 'manual' && job.status === 'staging' && (
                              <p className="text-xs text-purple-400">{job.stagedRowCount} staged</p>
                            )}
                            {job.rowsInserted > 0 && (
                              <p className="text-xs text-emerald-400">{job.rowsInserted} inserted</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.startedAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not started</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/extraction-jobs/${job.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
