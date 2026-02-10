'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  List,
  ArrowRight,
  Database,
  Save,
  Table2,
  Brain,
  Sparkles,
  CheckCircle,
  XCircle as XCircleIcon,
} from 'lucide-react';
import { getWebSources, deleteWebSource, testWebSourceConnection, getAssignments, analyzeWebSourceWithSchema, updateExtractionRules, llmAnalyze, llmCreateCapture } from '@/lib/api';
import type { WebSource, Assignment, SchemaAwareAnalysis, ExtractionRuleFormData, LLMAnalysisResult, LLMColumnAnalysis, ExtractionMethod, LLMCaptureConfig } from '@/types';
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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence === 0) {
    return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs">No match</Badge>;
  }
  if (confidence >= 0.8) {
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">{Math.round(confidence * 100)}%</Badge>;
  }
  if (confidence >= 0.5) {
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">{Math.round(confidence * 100)}%</Badge>;
  }
  return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">{Math.round(confidence * 100)}%</Badge>;
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

  // Schema-aware analysis state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
  const [pendingAnalyzeId, setPendingAnalyzeId] = useState<string | null>(null);
  const [pickerAssignments, setPickerAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [schemaAnalysis, setSchemaAnalysis] = useState<SchemaAwareAnalysis | null>(null);
  const [acceptedMappings, setAcceptedMappings] = useState<Set<string>>(new Set());
  const [savingRules, setSavingRules] = useState(false);
  const [analyzingWebSourceName, setAnalyzingWebSourceName] = useState('');

  // LLM analysis state
  const [analysisMethod, setAnalysisMethod] = useState<ExtractionMethod>('selector');
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResult | null>(null);
  const [creatingCapture, setCreatingCapture] = useState(false);
  const [captureCreated, setCaptureCreated] = useState(false);
  const [captureConfig, setCaptureConfig] = useState<LLMCaptureConfig | null>(null);
  const [showCaptureDetails, setShowCaptureDetails] = useState(false);

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
    setAnalyzingWebSourceName(webSource?.name || 'Web Source');
    setLoadingAssignments(true);
    setPendingAnalyzeId(id);

    // Fetch assignments for this web source
    const response = await getAssignments({ webSourceId: id });
    setLoadingAssignments(false);

    if (!response.success || !response.data) {
      toast.error('Failed to fetch assignments');
      setPendingAnalyzeId(null);
      return;
    }

    const assignments = response.data;

    if (assignments.length === 0) {
      toast.error('No assignments found. Create an assignment for this web source first to enable schema-aware analysis.');
      setPendingAnalyzeId(null);
      return;
    }

    // Always show picker so user can choose extraction method
    setPickerAssignments(assignments);
    setShowAssignmentPicker(true);
  }

  async function runSchemaAnalysis(webSourceId: string, assignmentId: string) {
    setShowAssignmentPicker(false);
    setAnalyzingId(webSourceId);
    setSchemaAnalysis(null);
    setLlmAnalysis(null);
    setAcceptedMappings(new Set());
    setCaptureCreated(false);
    setShowAnalysisDialog(true);

    if (analysisMethod === 'llm') {
      // LLM-based analysis
      const response = await llmAnalyze(assignmentId);

      if (response.success && response.data) {
        setLlmAnalysis(response.data.result);
        toast.success(`Found data for ${response.data.result.summary.availableColumns} of ${response.data.result.summary.totalColumns} columns`);
      } else {
        toast.error(response.error || 'Failed to analyze with LLM');
        setShowAnalysisDialog(false);
      }
    } else {
      // Selector-based analysis (existing)
      const response = await analyzeWebSourceWithSchema(webSourceId, assignmentId);

      if (response.success && response.data) {
        const result = response.data.result;
        setSchemaAnalysis(result);

        const initialAccepted = new Set<string>();
        result.proposedMappings.forEach(m => {
          if (m.confidence > 0) initialAccepted.add(m.targetColumn);
        });
        setAcceptedMappings(initialAccepted);

        setWebSources((prev) =>
          prev.map((ws) =>
            ws.id === webSourceId ? { ...ws, lastAnalyzedAt: new Date() } : ws
          )
        );

        toast.success(`Mapped ${result.summary.mappedColumns} of ${result.summary.totalColumns} columns`);
      } else {
        toast.error(response.error || 'Failed to analyze with schema');
        setShowAnalysisDialog(false);
      }
    }

    setAnalyzingId(null);
    setPendingAnalyzeId(null);
  }

  async function handleCreateCapture() {
    if (!llmAnalysis) return;
    setCreatingCapture(true);

    const response = await llmCreateCapture(llmAnalysis.assignmentId, llmAnalysis.columns);

    if (response.success) {
      setCaptureCreated(true);
      if (response.data?.captureConfig) {
        setCaptureConfig(response.data.captureConfig);
        setShowCaptureDetails(true);
      }
      toast.success(response.data?.message || 'Structured capture created');
    } else {
      toast.error(response.error || 'Failed to create structured capture');
    }

    setCreatingCapture(false);
  }

  function toggleMapping(targetColumn: string) {
    setAcceptedMappings(prev => {
      const next = new Set(prev);
      if (next.has(targetColumn)) {
        next.delete(targetColumn);
      } else {
        next.add(targetColumn);
      }
      return next;
    });
  }

  async function handleSaveRules() {
    if (!schemaAnalysis) return;
    setSavingRules(true);

    const rules: ExtractionRuleFormData[] = schemaAnalysis.proposedMappings
      .filter(m => acceptedMappings.has(m.targetColumn) && m.confidence > 0)
      .map(m => ({
        targetColumn: m.targetColumn,
        selector: m.selector,
        selectorType: m.selectorType || 'css',
        attribute: m.attribute || 'text',
        transformType: m.transformType,
        transformConfig: m.transformConfig,
        dataType: m.dataType || 'string',
        isRequired: m.isRequired,
      }));

    const response = await updateExtractionRules(schemaAnalysis.assignmentId, rules);

    if (response.success) {
      toast.success(`Saved ${rules.length} extraction rules to "${schemaAnalysis.assignmentName}"`);
      setShowAnalysisDialog(false);
      setSchemaAnalysis(null);
    } else {
      toast.error(response.error || 'Failed to save rules');
    }

    setSavingRules(false);
  }

  const acceptedCount = schemaAnalysis
    ? schemaAnalysis.proposedMappings.filter(m => acceptedMappings.has(m.targetColumn) && m.confidence > 0).length
    : 0;

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
                isAnalyzing={analyzingId === ws.id || (loadingAssignments && pendingAnalyzeId === ws.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
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

      {/* Assignment Picker Dialog */}
      <Dialog open={showAssignmentPicker} onOpenChange={(open) => { setShowAssignmentPicker(open); if (!open) setPendingAnalyzeId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Analyze Structure</DialogTitle>
            <DialogDescription>
              Choose an extraction method and select the target assignment.
            </DialogDescription>
          </DialogHeader>

          {/* Method Toggle */}
          <div className="flex gap-2 p-1 rounded-lg bg-muted">
            <button
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                analysisMethod === 'selector'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setAnalysisMethod('selector')}
            >
              <Search className="h-4 w-4" />
              CSS/XPath Selectors
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                analysisMethod === 'llm'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setAnalysisMethod('llm')}
            >
              <Brain className="h-4 w-4" />
              LLM Extraction
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {analysisMethod === 'selector'
              ? 'Uses CSS selectors to map website elements to database columns. Best for structured, repeating elements.'
              : 'Uses AI to analyze page content and extract data using structured output. Best for complex or varied page layouts.'}
          </p>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pickerAssignments.map((assignment) => (
              <button
                key={assignment.id}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => pendingAnalyzeId && runSchemaAnalysis(pendingAnalyzeId, assignment.id)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                  <Table2 className="h-4 w-4 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{assignment.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {assignment.targetSchema}.{assignment.targetTable}
                    {assignment.dataSource ? ` on ${assignment.dataSource.name}` : ''}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schema-Aware Analysis Results Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { setShowAnalysisDialog(open); if (!open) { setSchemaAnalysis(null); setLlmAnalysis(null); setAcceptedMappings(new Set()); setCaptureCreated(false); setCaptureConfig(null); setShowCaptureDetails(false); } }}>
        <DialogContent className="w-[80vw] max-w-[1000px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Analysis Results: {analyzingWebSourceName}</DialogTitle>
            <DialogDescription>
              {analyzingId
                ? analysisMethod === 'llm'
                  ? 'Analyzing page content with LLM...'
                  : 'Analyzing website structure with database schema...'
                : schemaAnalysis
                  ? `Mapping web data to ${schemaAnalysis.targetSchema}.${schemaAnalysis.targetTable} on ${schemaAnalysis.dataSourceName}`
                  : llmAnalysis
                    ? `LLM analysis of ${llmAnalysis.targetTable} on ${llmAnalysis.dataSourceName}`
                    : ''}
            </DialogDescription>
          </DialogHeader>

          {analyzingId ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              {analysisMethod === 'llm' ? (
                <>
                  <p className="text-muted-foreground">LLM is analyzing the page content...</p>
                  <p className="text-sm text-muted-foreground mt-1">Checking which database columns can be populated from this page</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Analyzing website with database schema context...</p>
                  <p className="text-sm text-muted-foreground mt-1">Discovering table columns and matching web fields</p>
                </>
              )}
            </div>
          ) : llmAnalysis ? (
            /* LLM Analysis Results */
            <div className="space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Summary Banner */}
              <div className="flex items-center gap-4 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium">
                    Found data for {llmAnalysis.summary.availableColumns} of {llmAnalysis.summary.totalColumns} columns
                  </span>
                </div>
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                  LLM Analysis
                </Badge>
                {llmAnalysis.summary.unavailableColumns.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {llmAnalysis.summary.unavailableColumns.length} not found
                  </span>
                )}
              </div>

              {/* LLM Column Analysis */}
              <ScrollArea className="h-[50vh]">
                <div className="space-y-1">
                  <div className="grid grid-cols-[24px_1fr_1fr_80px] gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                    <div></div>
                    <div>Database Column</div>
                    <div>Page Analysis</div>
                    <div className="text-right">Confidence</div>
                  </div>

                  {llmAnalysis.columns.map((col) => (
                    <div
                      key={col.columnName}
                      className={`grid grid-cols-[24px_1fr_1fr_80px] gap-2 items-center px-2 py-2 rounded-md ${
                        col.isAvailable ? 'hover:bg-muted/50' : 'opacity-60'
                      }`}
                    >
                      <div className="flex justify-center">
                        {col.isAvailable ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="font-medium text-sm truncate block">{col.columnName}</span>
                        <span className="text-xs text-muted-foreground">{col.columnType}</span>
                      </div>

                      <div className="min-w-0">
                        {col.isAvailable ? (
                          <>
                            <span className="text-sm truncate block">{col.reasoning}</span>
                            {col.sampleValue && (
                              <span className="text-[11px] text-muted-foreground truncate block" title={col.sampleValue}>
                                Sample: &quot;{col.sampleValue}&quot;
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{col.reasoning}</span>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <ConfidenceBadge confidence={col.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Capture Config Viewer (shown after creation) */}
              {captureCreated && captureConfig && showCaptureDetails && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      Structured Capture Created
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Model: <Badge variant="outline" className="text-[10px] px-1.5">{captureConfig.model}</Badge></span>
                      <span className="text-muted-foreground">Temp: <Badge variant="outline" className="text-[10px] px-1.5">{captureConfig.temperature}</Badge></span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Column Mappings ({captureConfig.columnMappings.length})</span>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-2 py-1 font-medium">DB Column</th>
                            <th className="text-left px-2 py-1 font-medium">JSON Field</th>
                            <th className="text-left px-2 py-1 font-medium">Type</th>
                            <th className="text-left px-2 py-1 font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {captureConfig.columnMappings.map((m) => (
                            <tr key={m.columnName} className="border-t">
                              <td className="px-2 py-1 font-mono">{m.columnName}</td>
                              <td className="px-2 py-1 font-mono">{m.jsonField}</td>
                              <td className="px-2 py-1">{m.dataType}</td>
                              <td className="px-2 py-1 text-muted-foreground truncate max-w-[200px]">{m.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View System Prompt</summary>
                    <pre className="mt-2 bg-muted rounded-md p-2 overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre-wrap font-mono text-[11px]">
                      {captureConfig.systemPrompt}
                    </pre>
                  </details>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View JSON Schema</summary>
                    <pre className="mt-2 bg-muted rounded-md p-2 overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre-wrap font-mono text-[11px]">
                      {JSON.stringify(captureConfig.jsonSchema, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {/* Footer Actions - Create Structured Capture */}
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {captureCreated
                    ? `Structured capture saved for "${llmAnalysis.assignmentName}"`
                    : `${llmAnalysis.summary.availableColumns} columns available for extraction`}
                </p>
                <div className="flex items-center gap-2">
                  {captureCreated && captureConfig && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCaptureDetails(!showCaptureDetails)}
                    >
                      {showCaptureDetails ? 'Hide Details' : 'View Config'}
                    </Button>
                  )}
                  <Button
                    onClick={handleCreateCapture}
                    disabled={creatingCapture || captureCreated || llmAnalysis.summary.availableColumns === 0}
                  >
                    {creatingCapture ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : captureCreated ? (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {captureCreated ? 'Capture Created' : 'Create Structured Capture'}
                  </Button>
                </div>
              </div>
            </div>
          ) : schemaAnalysis ? (
            /* Selector-Based Analysis Results */
            <div className="space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Summary Banner */}
              <div className="flex items-center gap-4 rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Mapped {schemaAnalysis.summary.mappedColumns} of {schemaAnalysis.summary.totalColumns} columns
                  </span>
                </div>
                {schemaAnalysis.summary.averageConfidence > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Avg confidence: {Math.round(schemaAnalysis.summary.averageConfidence * 100)}%
                  </Badge>
                )}
                {schemaAnalysis.summary.unmappedColumns.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {schemaAnalysis.summary.unmappedColumns.length} unmapped
                  </span>
                )}
              </div>

              {/* Mappings Table */}
              <ScrollArea className="h-[50vh]">
                <div className="space-y-1">
                  <div className="grid grid-cols-[32px_1fr_24px_1fr_80px] gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                    <div></div>
                    <div>Database Column</div>
                    <div></div>
                    <div>Web Field</div>
                    <div className="text-right">Confidence</div>
                  </div>

                  {schemaAnalysis.proposedMappings.map((mapping) => {
                    const isAccepted = acceptedMappings.has(mapping.targetColumn);
                    const hasMapped = mapping.confidence > 0;

                    return (
                      <div
                        key={mapping.targetColumn}
                        className={`grid grid-cols-[32px_1fr_24px_1fr_80px] gap-2 items-center px-2 py-2 rounded-md ${
                          hasMapped ? 'hover:bg-muted/50' : 'opacity-60'
                        }`}
                      >
                        <div className="flex justify-center">
                          {hasMapped && (
                            <Checkbox
                              checked={isAccepted}
                              onCheckedChange={() => toggleMapping(mapping.targetColumn)}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{mapping.targetColumn}</span>
                            {mapping.dbColumn.isPrimaryKey && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">PK</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{mapping.dbColumn.type}{mapping.dbColumn.nullable ? ', nullable' : ''}</span>
                        </div>

                        <div className="flex justify-center">
                          {hasMapped && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>

                        <div className="min-w-0">
                          {hasMapped && mapping.webField ? (
                            <>
                              <span className="text-sm truncate block">{mapping.webField.name}</span>
                              <code className="text-[11px] text-muted-foreground truncate block">{mapping.selector}</code>
                              {mapping.sampleValue && (
                                <span className="text-[11px] text-muted-foreground truncate block" title={mapping.sampleValue}>
                                  Sample: {mapping.sampleValue}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No match found</span>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <ConfidenceBadge confidence={mapping.confidence} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  {acceptedCount} rule{acceptedCount !== 1 ? 's' : ''} selected for &quot;{schemaAnalysis.assignmentName}&quot;
                </p>
                <Button onClick={handleSaveRules} disabled={savingRules || acceptedCount === 0}>
                  {savingRules ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save {acceptedCount} Rule{acceptedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
