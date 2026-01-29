'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  RefreshCw,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Clock,
  Database,
  Table2,
  Loader2
} from 'lucide-react';
import { getSyncConfigs, deleteSyncConfig, triggerSync } from '@/lib/api';
import type { SyncConfig, DataSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const scheduleLabels: Record<string, string> = {
  manual: 'Manual',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  cron: 'Custom (Cron)',
};

function SyncConfigCard({
  config,
  onDelete,
  onRun,
  isRunning
}: {
  config: SyncConfig & {
    dataSource?: Partial<DataSource>;
    _count?: { tableConfigs: number; syncJobs: number };
  };
  onDelete: () => void;
  onRun: () => void;
  isRunning: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/10">
            <RefreshCw className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{config.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span>{config.dataSource?.name || 'Unknown'}</span>
            </CardDescription>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRun} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Now
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/sync-configs/${config.id}`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {config.isActive ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
          
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {scheduleLabels[config.scheduleType] || config.scheduleType}
          </Badge>
          
          <Badge variant="outline">
            {config.syncMode === 'full' ? 'Full Sync' : 'Incremental'}
          </Badge>

          {config._count?.tableConfigs ? (
            <Badge variant="secondary" className="gap-1">
              <Table2 className="h-3 w-3" />
              {config._count.tableConfigs} table{config._count.tableConfigs !== 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>
        
        {config.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {config.description}
          </p>
        )}
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Output: {config.outputFileName}</span>
          <span>Created {formatDistanceToNow(new Date(config.createdAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SyncConfigsPage() {
  const [syncConfigs, setSyncConfigs] = useState<(SyncConfig & {
    dataSource?: Partial<DataSource>;
    _count?: { tableConfigs: number; syncJobs: number };
  })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncConfigs();
  }, []);

  async function fetchSyncConfigs() {
    const response = await getSyncConfigs();
    if (response.success && response.data) {
      setSyncConfigs(response.data);
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    
    const response = await deleteSyncConfig(deleteId);
    if (response.success) {
      setSyncConfigs((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success('Sync configuration deleted');
    } else {
      toast.error('Failed to delete sync configuration');
    }
    setDeleteId(null);
  }

  async function handleRun(id: string) {
    setRunningId(id);
    const response = await triggerSync(id);
    
    if (response.success) {
      toast.success('Sync job started');
    } else {
      toast.error(response.error || 'Failed to start sync');
    }
    
    setRunningId(null);
  }

  return (
    <>
      <Header
        title="Sync Configurations"
        description="Manage your data synchronization settings"
        actions={
          <Button asChild>
            <Link href="/sync-configs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Config
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : syncConfigs.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/10">
                <RefreshCw className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No sync configurations</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a sync configuration to start extracting data
              </p>
              <Button asChild className="mt-6">
                <Link href="/sync-configs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Config
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {syncConfigs.map((config) => (
              <SyncConfigCard
                key={config.id}
                config={config}
                onDelete={() => setDeleteId(config.id)}
                onRun={() => handleRun(config.id)}
                isRunning={runningId === config.id}
              />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sync Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sync configuration and all its job history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

