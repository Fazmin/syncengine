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
  Globe,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Bot,
} from 'lucide-react';
import { getWebSources, deleteWebSource, testWebSourceConnection, analyzeWebSource } from '@/lib/api';
import type { WebSource } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const scraperTypeLabels: Record<string, string> = {
  browser: 'Browser',
  http: 'HTTP',
  hybrid: 'Hybrid',
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

function WebSourceCard({
  webSource,
  onDelete,
  onTest,
  onAnalyze,
  isTesting,
  isAnalyzing
}: {
  webSource: WebSource & { _count?: { assignments: number } };
  onDelete: () => void;
  onTest: () => void;
  onAnalyze: () => void;
  isTesting: boolean;
  isAnalyzing: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/10">
            <Globe className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{webSource.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 max-w-[300px] truncate">
              <span>{webSource.baseUrl}</span>
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
              <Link href={`/web-sources/${webSource.id}`}>
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
            <DropdownMenuItem onClick={onAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Analyze Structure
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
          <ConnectionStatusBadge status={webSource.connectionStatus} />
          
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            {scraperTypeLabels[webSource.scraperType] || webSource.scraperType}
          </Badge>
          
          {webSource.paginationType && webSource.paginationType !== 'none' && (
            <Badge variant="secondary">
              Pagination: {webSource.paginationType}
            </Badge>
          )}
          
          {webSource._count?.assignments ? (
            <Badge variant="secondary">
              {webSource._count.assignments} assignment{webSource._count.assignments !== 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Delay: {webSource.requestDelay}ms</span>
          {webSource.lastAnalyzedAt && (
            <span>
              Analyzed {formatDistanceToNow(new Date(webSource.lastAnalyzedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WebSourcesPage() {
  const [webSources, setWebSources] = useState<(WebSource & { _count?: { assignments: number } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWebSources();
  }, []);

  async function fetchWebSources() {
    const response = await getWebSources();
    if (response.success && response.data) {
      setWebSources(response.data);
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    
    const response = await deleteWebSource(deleteId);
    if (response.success) {
      setWebSources((prev) => prev.filter((ws) => ws.id !== deleteId));
      toast.success('Web source deleted');
    } else {
      toast.error(response.error || 'Failed to delete web source');
    }
    setDeleteId(null);
  }

  async function handleTest(id: string) {
    setTestingId(id);
    const response = await testWebSourceConnection(id);
    
    if (response.success && response.data) {
      setWebSources((prev) =>
        prev.map((ws) =>
          ws.id === id ? { 
            ...ws, 
            connectionStatus: response.data?.success ? 'connected' : 'failed', 
            lastTestedAt: new Date() 
          } : ws
        )
      );
      
      if (response.data.success) {
        toast.success('Connection successful');
      } else {
        toast.error(response.data.error || 'Connection failed');
      }
    } else {
      toast.error('Failed to test connection');
    }
    
    setTestingId(null);
  }

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    const response = await analyzeWebSource(id);
    
    if (response.success && response.data) {
      setWebSources((prev) =>
        prev.map((ws) =>
          ws.id === id ? { 
            ...ws, 
            lastAnalyzedAt: new Date(),
            paginationType: response.data?.structure?.pagination?.type || ws.paginationType,
          } : ws
        )
      );
      
      const structure = response.data.structure;
      toast.success(`Found ${structure?.repeatingElements?.length || 0} data patterns${structure?.pagination ? ' with pagination' : ''}`);
    } else {
      toast.error('Failed to analyze website');
    }
    
    setAnalyzingId(null);
  }

  return (
    <>
      <Header
        title="Web Sources"
        description="Manage websites to scrape data from"
        actions={
          <Button asChild>
            <Link href="/web-sources/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Web Source
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
        ) : webSources.length === 0 ? (
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-600/10">
                <Globe className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No web sources yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first website to start extracting data
              </p>
              <Button asChild className="mt-6">
                <Link href="/web-sources/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Web Source
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {webSources.map((ws) => (
              <WebSourceCard
                key={ws.id}
                webSource={ws}
                onDelete={() => setDeleteId(ws.id)}
                onTest={() => handleTest(ws.id)}
                onAnalyze={() => handleAnalyze(ws.id)}
                isTesting={testingId === ws.id}
                isAnalyzing={analyzingId === ws.id}
              />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Web Source</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this web source. Any assignments using this
              web source will also be deleted. This action cannot be undone.
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
