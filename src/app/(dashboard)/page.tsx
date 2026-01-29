'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Server
} from 'lucide-react';
import Link from 'next/link';
import { getDashboardStats } from '@/lib/api';
import type { DashboardStats, SyncJob } from '@/types';
import { formatDistanceToNow } from 'date-fns';

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default'
}: {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'from-slate-500/20 to-slate-600/10 border-slate-500/20',
    success: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30',
    warning: 'from-amber-500/20 to-orange-600/10 border-amber-500/30',
    danger: 'from-red-500/20 to-rose-600/10 border-red-500/30',
  };

  const iconStyles = {
    default: 'text-slate-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <Card className={`relative overflow-hidden border bg-gradient-to-br ${variantStyles[variant]}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconStyles[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">+{trend.value}%</span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; className: string }> = {
    completed: { variant: 'default', icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    running: { variant: 'default', icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    failed: { variant: 'destructive', icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    pending: { variant: 'secondary', icon: Clock, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    cancelled: { variant: 'outline', icon: XCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  );
}

function RecentJobsTable({ jobs, isLoading }: { jobs: SyncJob[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 text-sm text-muted-foreground">No sync jobs yet</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/sync-configs">Create your first sync</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-accent"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/10">
            <RefreshCw className="h-5 w-5 text-violet-400" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate font-medium">
              {job.syncConfig?.name || 'Unknown Config'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {job.status === 'completed' && (
              <span className="text-xs text-muted-foreground">
                {job.rowsProcessed.toLocaleString()} rows
              </span>
            )}
            <JobStatusBadge status={job.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const response = await getDashboardStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
      setIsLoading(false);
    }
    fetchStats();
  }, []);

  const successRate = stats?.totalSyncJobs
    ? Math.round((stats.successfulJobs / stats.totalSyncJobs) * 100)
    : 0;

  return (
    <>
      <Header
        title="Dashboard"
        description="Monitor your data synchronization at a glance"
      />
      
      <main className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                title="Data Sources"
                value={stats?.totalDataSources || 0}
                description={`${stats?.activeDataSources || 0} active`}
                icon={Database}
                variant="default"
              />
              <StatCard
                title="Sync Configs"
                value={stats?.totalSyncConfigs || 0}
                description={`${stats?.activeSyncConfigs || 0} active`}
                icon={RefreshCw}
                variant="default"
              />
              <StatCard
                title="Successful Syncs"
                value={stats?.successfulJobs || 0}
                description={`${successRate}% success rate`}
                icon={CheckCircle2}
                variant="success"
              />
              <StatCard
                title="Running Jobs"
                value={stats?.runningJobs || 0}
                description={`${stats?.failedJobs || 0} failed`}
                icon={Loader2}
                variant={stats?.runningJobs ? 'warning' : 'default'}
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Recent Jobs */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Sync Jobs</CardTitle>
                <CardDescription>Latest synchronization activities</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/jobs" className="gap-1">
                  View all
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <RecentJobsTable
                jobs={stats?.recentJobs || []}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Quick Actions & Status */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full justify-start gap-2" variant="outline">
                  <Link href="/data-sources/new">
                    <Database className="h-4 w-4" />
                    Add Data Source
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start gap-2" variant="outline">
                  <Link href="/sync-configs/new">
                    <RefreshCw className="h-4 w-4" />
                    Create Sync Config
                  </Link>
                </Button>
                <Button asChild className="w-full justify-start gap-2" variant="outline">
                  <Link href="/audit-logs">
                    <Activity className="h-4 w-4" />
                    View Audit Logs
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Service status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">API Server</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Online
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Config Database</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Scheduler</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
                
                <div className="pt-2">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Storage Usage</span>
                    <span>42%</span>
                  </div>
                  <Progress value={42} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
