'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, Globe, Loader2, Zap, Search, CheckCircle2, XCircle, AlertCircle, List, Database, Save, Table2, Brain, Sparkles, CheckCircle, XCircle as XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { getWebSource, updateWebSource, testWebSourceConnection, getAssignments, analyzeWebSourceWithSchema, updateExtractionRules, llmAnalyze, llmCreateCapture } from '@/lib/api';
import { toast } from 'sonner';
import type { WebSource, WebSourceFormData, Assignment, SchemaAwareAnalysis, ExtractionRuleFormData, LLMAnalysisResult, ExtractionMethod, LLMCaptureConfig } from '@/types';

function ConnectionStatusBadge({ status }: { status: string }) {
  const config = {
    connected: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Connected' },
    failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' },
    untested: { icon: AlertCircle, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Untested' },
  }[status] || { icon: AlertCircle, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: status };

  const Icon = config.icon;

  return (
    <Badge className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
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

export default function EditWebSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [webSource, setWebSource] = useState<WebSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState<Partial<WebSourceFormData>>({});

  // Schema-aware analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAssignmentPicker, setShowAssignmentPicker] = useState(false);
  const [pickerAssignments, setPickerAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [schemaAnalysis, setSchemaAnalysis] = useState<SchemaAwareAnalysis | null>(null);
  const [acceptedMappings, setAcceptedMappings] = useState<Set<string>>(new Set());
  const [savingRules, setSavingRules] = useState(false);

  // LLM analysis state
  const [analysisMethod, setAnalysisMethod] = useState<ExtractionMethod>('selector');
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResult | null>(null);
  const [creatingCapture, setCreatingCapture] = useState(false);
  const [captureCreated, setCaptureCreated] = useState(false);
  const [captureConfig, setCaptureConfig] = useState<LLMCaptureConfig | null>(null);
  const [showCaptureDetails, setShowCaptureDetails] = useState(false);

  useEffect(() => {
    fetchWebSource();
  }, [id]);

  async function fetchWebSource() {
    const response = await getWebSource(id);
    if (response.success && response.data) {
      setWebSource(response.data);
      setFormData({
        name: response.data.name,
        baseUrl: response.data.baseUrl,
        description: response.data.description || '',
        scraperType: response.data.scraperType as 'browser' | 'http' | 'hybrid',
        authType: response.data.authType as 'none' | 'cookie' | 'header' | 'basic',
        requestDelay: response.data.requestDelay,
        maxConcurrent: response.data.maxConcurrent,
      });
    } else {
      toast.error('Failed to load web source');
      router.push('/web-sources');
    }
    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    const response = await updateWebSource(id, formData);

    if (response.success) {
      toast.success('Web source updated');
      setWebSource(response.data || null);
    } else {
      toast.error(response.error || 'Failed to update web source');
    }

    setIsSaving(false);
  }

  async function handleTest() {
    setIsTesting(true);
    const response = await testWebSourceConnection(id);

    if (response.success && response.data) {
      if (response.data.success) {
        toast.success('Connection successful');
        setWebSource(prev => prev ? { ...prev, connectionStatus: 'connected' } : null);
      } else {
        toast.error(response.data.error || 'Connection failed');
        setWebSource(prev => prev ? { ...prev, connectionStatus: 'failed' } : null);
      }
    } else {
      toast.error('Failed to test connection');
    }

    setIsTesting(false);
  }

  async function handleAnalyze() {
    setLoadingAssignments(true);

    // Fetch assignments for this web source
    const response = await getAssignments({ webSourceId: id });
    setLoadingAssignments(false);

    if (!response.success || !response.data) {
      toast.error('Failed to fetch assignments');
      return;
    }

    const assignments = response.data;

    if (assignments.length === 0) {
      toast.error('No assignments found. Create an assignment for this web source first to enable schema-aware analysis.');
      return;
    }

    // Always show picker so user can choose extraction method
    setPickerAssignments(assignments);
    setShowAssignmentPicker(true);
  }

  async function runSchemaAnalysis(assignmentId: string) {
    setShowAssignmentPicker(false);
    setIsAnalyzing(true);
    setSchemaAnalysis(null);
    setLlmAnalysis(null);
    setAcceptedMappings(new Set());
    setCaptureCreated(false);
    setShowAnalysisDialog(true);

    if (analysisMethod === 'llm') {
      const response = await llmAnalyze(assignmentId);

      if (response.success && response.data) {
        setLlmAnalysis(response.data.result);
        toast.success(`Found data for ${response.data.result.summary.availableColumns} of ${response.data.result.summary.totalColumns} columns`);
      } else {
        toast.error(response.error || 'Failed to analyze with LLM');
        setShowAnalysisDialog(false);
      }
    } else {
      const response = await analyzeWebSourceWithSchema(id, assignmentId);

      if (response.success && response.data) {
        const result = response.data.result;
        setSchemaAnalysis(result);

        const initialAccepted = new Set<string>();
        result.proposedMappings.forEach(m => {
          if (m.confidence > 0) initialAccepted.add(m.targetColumn);
        });
        setAcceptedMappings(initialAccepted);

        toast.success(`Mapped ${result.summary.mappedColumns} of ${result.summary.totalColumns} columns`);
        setWebSource(prev => prev ? {
          ...prev,
          lastAnalyzedAt: new Date(),
        } : null);
      } else {
        toast.error(response.error || 'Failed to analyze with schema');
        setShowAnalysisDialog(false);
      }
    }

    setIsAnalyzing(false);
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

  if (isLoading) {
    return (
      <>
        <Header title="Edit Web Source" />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title="Edit Web Source"
        description={webSource?.name}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Test
            </Button>
            <Button variant="outline" onClick={handleAnalyze} disabled={isAnalyzing || loadingAssignments}>
              {(isAnalyzing || loadingAssignments) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Analyze
            </Button>
            <Button variant="outline" asChild>
              <Link href="/web-sources">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/10">
                    <Globe className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Website details</CardDescription>
                  </div>
                </div>
                <ConnectionStatusBadge status={webSource?.connectionStatus || 'untested'} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  type="url"
                  value={formData.baseUrl || ''}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* URL List Card - shown when in list mode */}
          {webSource?.isListMode && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-600/10">
                    <List className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle>URL List</CardTitle>
                    <CardDescription>
                      {(() => {
                        try {
                          const urls = webSource.urlList ? JSON.parse(webSource.urlList) : [];
                          return `${1 + urls.length} URLs in this list`;
                        } catch {
                          return 'Multiple URLs configured';
                        }
                      })()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                    <Badge variant="outline" className="shrink-0">Primary</Badge>
                    <span className="font-mono text-xs truncate">{webSource.baseUrl}</span>
                  </div>
                  {(() => {
                    try {
                      const urls = webSource.urlList ? JSON.parse(webSource.urlList) : [];
                      return urls.map((url: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
                          <Badge variant="secondary" className="shrink-0">{index + 2}</Badge>
                          <span className="font-mono text-xs truncate">{url}</span>
                        </div>
                      ));
                    } catch {
                      return null;
                    }
                  })()}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  The first URL is used for analysis. Rules learned from it are applied to all URLs during extraction.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Scraping Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scraperType">Scraper Type</Label>
                  <Select
                    value={formData.scraperType}
                    onValueChange={(value) => setFormData({ ...formData, scraperType: value as 'browser' | 'http' | 'hybrid' })}
                  >
                    <SelectTrigger id="scraperType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="http">HTTP Only</SelectItem>
                      <SelectItem value="browser">Browser</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authType">Authentication</Label>
                  <Select
                    value={formData.authType}
                    onValueChange={(value) => setFormData({ ...formData, authType: value as 'none' | 'cookie' | 'header' | 'basic' })}
                  >
                    <SelectTrigger id="authType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="cookie">Cookie</SelectItem>
                      <SelectItem value="header">Custom Header</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="requestDelay">Request Delay (ms)</Label>
                  <Input
                    id="requestDelay"
                    type="number"
                    min={0}
                    value={formData.requestDelay}
                    onChange={(e) => setFormData({ ...formData, requestDelay: parseInt(e.target.value) || 1000 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxConcurrent">Max Concurrent</Label>
                  <Input
                    id="maxConcurrent"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.maxConcurrent}
                    onChange={(e) => setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {webSource?.paginationType && (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="text-sm font-medium">Detected Pagination</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Type: {webSource.paginationType}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/web-sources">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </main>

      {/* Assignment Picker Dialog */}
      <Dialog open={showAssignmentPicker} onOpenChange={setShowAssignmentPicker}>
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
                onClick={() => runSchemaAnalysis(assignment.id)}
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

      {/* Analysis Results Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { setShowAnalysisDialog(open); if (!open) { setSchemaAnalysis(null); setLlmAnalysis(null); setAcceptedMappings(new Set()); setCaptureCreated(false); setCaptureConfig(null); setShowCaptureDetails(false); } }}>
        <DialogContent className="w-[80vw] max-w-[1000px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Analysis Results: {webSource?.name}</DialogTitle>
            <DialogDescription>
              {isAnalyzing
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

          {isAnalyzing ? (
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
