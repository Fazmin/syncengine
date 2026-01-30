'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  List,
} from 'lucide-react';
import { getWebSources, deleteWebSource, testWebSourceConnection, analyzeWebSource } from '@/lib/api';
import type { WebSource, WebsiteStructure } from '@/types';
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
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/10">
            <Globe className="h-6 w-6 text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg truncate">{webSource.name}</CardTitle>
            <CardDescription className="truncate">
              {webSource.baseUrl}
            </CardDescription>
          </div>
        </div>
        <CardAction>
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
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectionStatusBadge status={webSource.connectionStatus} />
          
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            {scraperTypeLabels[webSource.scraperType] || webSource.scraperType}
          </Badge>

          {webSource.isListMode && (
            <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-400 border-purple-500/20">
              <List className="h-3 w-3" />
              {(() => {
                try {
                  const additionalUrls = webSource.urlList ? JSON.parse(webSource.urlList) : [];
                  return `${1 + additionalUrls.length} URLs`;
                } catch {
                  return 'List Mode';
                }
              })()}
            </Badge>
          )}
          
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
  const [analysisResults, setAnalysisResults] = useState<{ webSourceName: string; structure: WebsiteStructure } | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analyzingWebSourceName, setAnalyzingWebSourceName] = useState<string>('');

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
    const webSource = webSources.find(ws => ws.id === id);
    setAnalyzingId(id);
    setAnalysisResults(null);
    setAnalyzingWebSourceName(webSource?.name || 'Web Source');
    setShowAnalysisDialog(true); // Show dialog immediately in loading state
    
    const response = await analyzeWebSource(id);
    
    if (response.success && response.data) {
      const structure = response.data.structure;
      
      setWebSources((prev) =>
        prev.map((ws) =>
          ws.id === id ? { 
            ...ws, 
            lastAnalyzedAt: new Date(),
            paginationType: structure?.pagination?.type || ws.paginationType,
          } : ws
        )
      );
      
      // Populate the dialog with results
      setAnalysisResults({
        webSourceName: webSource?.name || 'Web Source',
        structure: structure || {
          url: webSource?.baseUrl || '',
          title: 'Unknown',
          repeatingElements: [],
          forms: [],
          links: [],
        },
      });
      
      toast.success(`Found ${structure?.repeatingElements?.length || 0} data patterns${structure?.pagination ? ' with pagination' : ''}`);
    } else {
      toast.error(response.error || 'Failed to analyze website');
      setShowAnalysisDialog(false); // Close dialog on error
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

      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { setShowAnalysisDialog(open); if (!open) setAnalysisResults(null); }}>
        <DialogContent className="w-[80vw] max-w-[1400px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Analysis Results: {analysisResults?.webSourceName || analyzingWebSourceName}</DialogTitle>
            <DialogDescription>
              {analyzingId ? 'Analyzing website structure...' : `Detected data patterns and page structure from ${analysisResults?.structure?.url}`}
            </DialogDescription>
          </DialogHeader>
          
          {analyzingId ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Scanning page for data patterns...</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a few seconds</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Formatted View */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Formatted View</h3>
              <ScrollArea className="h-[60vh] pr-4 rounded-lg border p-4">
                <div className="space-y-6">
                  {/* Pagination Info */}
                  {analysisResults?.structure?.pagination && (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Pagination Detected</Badge>
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium">Type:</span> {analysisResults.structure.pagination.type}</p>
                        {analysisResults.structure.pagination.paramName && (
                          <p><span className="font-medium">Parameter:</span> {analysisResults.structure.pagination.paramName}</p>
                        )}
                        {analysisResults.structure.pagination.selector && (
                          <p><span className="font-medium">Selector:</span> <code className="bg-muted px-1 rounded">{analysisResults.structure.pagination.selector}</code></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Repeating Elements */}
                  {analysisResults?.structure?.repeatingElements && analysisResults.structure.repeatingElements.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="font-medium">Data Patterns Found ({analysisResults.structure.repeatingElements.length})</h4>
                      {analysisResults.structure.repeatingElements.map((element, index) => (
                        <div key={index} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <code className="text-sm bg-muted px-2 py-1 rounded">{element.selector}</code>
                            <Badge variant="outline">{element.count} items</Badge>
                          </div>
                          
                          {element.fields && element.fields.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground font-medium">Detected Fields:</p>
                              <div className="grid gap-2">
                                {element.fields.map((field, fieldIndex) => (
                                  <div key={fieldIndex} className="flex items-start gap-3 text-sm bg-muted/50 rounded p-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{field.name}</span>
                                        <Badge variant="outline" className="text-xs">{field.dataType}</Badge>
                                      </div>
                                      <code className="text-xs text-muted-foreground block mt-1">{field.selector} → {field.attribute}</code>
                                    </div>
                                    <div className="text-xs text-muted-foreground max-w-[150px] truncate" title={field.sampleValue}>
                                      Sample: {field.sampleValue}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No repeating data patterns detected on this page.</p>
                      <p className="text-sm">Try analyzing a page with lists, tables, or product grids.</p>
                    </div>
                  )}

                  {/* Forms */}
                  {analysisResults?.structure?.forms && analysisResults.structure.forms.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Forms Found ({analysisResults.structure.forms.length})</h4>
                      {analysisResults.structure.forms.map((form, index) => (
                        <div key={index} className="text-sm bg-muted/50 rounded p-2">
                          <p><span className="font-medium">Action:</span> {form.action || '(current page)'}</p>
                          <p><span className="font-medium">Method:</span> {form.method}</p>
                          <p><span className="font-medium">Fields:</span> {form.fields.join(', ') || 'None'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Column - JSON View */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">JSON Structure</h3>
              <ScrollArea className="h-[60vh] rounded-lg border bg-slate-950">
                <pre className="p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(analysisResults?.structure, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
