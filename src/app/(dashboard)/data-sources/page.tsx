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
  Database,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { getDataSources, deleteDataSource, testDataSourceConnection } from '@/lib/api';
import type { DataSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const dbTypeIcons: Record<string, string> = {
  postgresql: '🐘',
  mysql: '🐬',
  mssql: '🪟',
  oracle: '🔶',
  sqlite: '📦',
};

const dbTypeLabels: Record<string, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mssql: 'SQL Server',
  oracle: 'Oracle',
  sqlite: 'SQLite',
};

function ConnectionStatusBadge({ status }: { status: string }) {
  const config = {
    connected: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    untested: { icon: AlertCircle, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  }[status] || { icon: AlertCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

  const Icon = config.icon;

  return (
    <Badge className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function DataSourceCard({
  dataSource,
  onDelete,
  onTest,
  isTesting
}: {
  dataSource: DataSource & { _count?: { syncConfigs: number } };
  onDelete: () => void;
  onTest: () => void;
  isTesting: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-600/10 text-2xl">
            {dbTypeIcons[dataSource.dbType] || '📦'}
          </div>
          <div>
            <CardTitle className="text-lg">{dataSource.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>{dbTypeLabels[dataSource.dbType] || dataSource.dbType}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="truncate max-w-[200px]">
                {dataSource.dbType === 'sqlite' 
                  ? dataSource.database 
                  : `${dataSource.host}:${dataSource.port}`}
              </span>
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
            <DropdownMenuItem asChild>
              <Link href={`/data-sources/${dataSource.id}`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTest} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Test Connection
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
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionStatusBadge status={dataSource.connectionStatus} />
          
          {dataSource.isActive ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20">
              Inactive
            </Badge>
          )}
          
          {dataSource._count?.syncConfigs ? (
            <Badge variant="secondary">
              {dataSource._count.syncConfigs} sync config{dataSource._count.syncConfigs !== 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Database: {dataSource.database}</span>
          {dataSource.lastTestedAt && (
            <span>
              Last tested {formatDistanceToNow(new Date(dataSource.lastTestedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<(DataSource & { _count?: { syncConfigs: number } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDataSources();
  }, []);

  async function fetchDataSources() {
    const response = await getDataSources();
    if (response.success && response.data) {
      setDataSources(response.data);
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    
    const response = await deleteDataSource(deleteId);
    if (response.success) {
      setDataSources((prev) => prev.filter((ds) => ds.id !== deleteId));
      toast.success('Data source deleted');
    } else {
      toast.error('Failed to delete data source');
    }
    setDeleteId(null);
  }

  async function handleTest(id: string) {
    setTestingId(id);
    const response = await testDataSourceConnection(id);
    
    if (response.success && response.data) {
      const { status, message } = response.data;
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === id ? { ...ds, connectionStatus: status, lastTestedAt: new Date() } : ds
        )
      );
      
      if (status === 'connected') {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } else {
      toast.error('Failed to test connection');
    }
    
    setTestingId(null);
  }

  return (
    <>
      <Header
        title="Data Sources"
        description="Manage your enterprise database connections"
        actions={
          <Button asChild>
            <Link href="/data-sources/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Data Source
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
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : dataSources.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/10">
                <Database className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No data sources yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first database connection to start syncing data
              </p>
              <Button asChild className="mt-6">
                <Link href="/data-sources/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Data Source
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dataSources.map((ds) => (
              <DataSourceCard
                key={ds.id}
                dataSource={ds}
                onDelete={() => setDeleteId(ds.id)}
                onTest={() => handleTest(ds.id)}
                isTesting={testingId === ds.id}
              />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this data source and all its sync configurations.
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

