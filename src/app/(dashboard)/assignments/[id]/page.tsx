'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ArrowLeft,
  GitBranch,
  Loader2,
  Play,
  Wand2,
  Plus,
  Trash2,
  Save,
  TestTube,
  CheckCircle2,
  Clock,
  Globe,
  Database,
  Brain,
  Sparkles,
  Search,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Code,
  Eye,
  AlertTriangle,
  XCircle,
  Maximize2,
  Rows3,
} from 'lucide-react';
import {
  getAssignment,
  updateAssignment,
  deleteAssignment,
  suggestMappings,
  updateExtractionRules,
  runSampleTest,
  triggerExtraction,
  llmAnalyze,
  llmCreateCapture,
} from '@/lib/api';
import type { Assignment, ExtractionRule, ExtractionRuleFormData, LLMAnalysisResult, LLMCaptureConfig } from '@/types';
import { toast } from 'sonner';

type AssignmentWithRelations = Assignment & {
  dataSource?: { id: string; name: string; dbType: string; host: string; database: string; connectionStatus: string };
  webSource?: { id: string; name: string; baseUrl: string; scraperType: string; paginationType?: string; connectionStatus: string };
  extractionRules?: ExtractionRule[];
  extractionJobs?: { id: string; status: string; createdAt: Date }[];
  _count?: { extractionRules: number; extractionJobs: number };
};

const statusConfig: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-slate-500/20 text-slate-400', label: 'Draft' },
  testing: { className: 'bg-blue-500/20 text-blue-400', label: 'Testing' },
  active: { className: 'bg-emerald-500/20 text-emerald-400', label: 'Active' },
  paused: { className: 'bg-amber-500/20 text-amber-400', label: 'Paused' },
  error: { className: 'bg-red-500/20 text-red-400', label: 'Error' },
};

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentWithRelations | null>(null);
  const [rules, setRules] = useState<ExtractionRuleFormData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ rows: Record<string, unknown>[]; columns?: string[]; error?: string; sourceUrl?: string } | null>(null);
  const [testViewMode, setTestViewMode] = useState<'table' | 'detail'>('table');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // LLM extraction state
  const [isLLMAnalyzing, setIsLLMAnalyzing] = useState(false);
  const [llmAnalysisResult, setLlmAnalysisResult] = useState<LLMAnalysisResult | null>(null);
  const [isCreatingCapture, setIsCreatingCapture] = useState(false);
  const [showCaptureConfig, setShowCaptureConfig] = useState(false);

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  async function fetchAssignment() {
    const response = await getAssignment(id);
    if (response.success && response.data) {
      setAssignment(response.data);
      // Convert extraction rules to form data
      if (response.data.extractionRules) {
        setRules(response.data.extractionRules.map(r => ({
          targetColumn: r.targetColumn,
          selector: r.selector,
          selectorType: r.selectorType as 'css' | 'xpath',
          attribute: r.attribute,
          transformType: r.transformType as 'trim' | 'regex' | 'date' | 'number' | 'json' | 'custom' | undefined,
          transformConfig: r.transformConfig || undefined,
          defaultValue: r.defaultValue || undefined,
          dataType: r.dataType as 'string' | 'number' | 'date' | 'boolean' | 'json',
          isRequired: r.isRequired,
          validationRegex: r.validationRegex || undefined,
        })));
      }
    } else {
      toast.error('Failed to load assignment');
      router.push('/assignments');
    }
    setIsLoading(false);
  }

  async function handleSuggestMappings() {
    setIsSuggesting(true);
    const response = await suggestMappings(id);
    
    if (response.success && response.data) {
      const { proposedRules, suggestions } = response.data;
      if (proposedRules && proposedRules.length > 0) {
        // Merge with existing rules (avoid duplicates)
        const existingColumns = new Set(rules.map(r => r.targetColumn));
        const newRules = proposedRules
          .filter(r => !existingColumns.has(r.targetColumn || ''))
          .map(r => ({
            targetColumn: r.targetColumn || '',
            selector: r.selector || '',
            selectorType: (r.selectorType || 'css') as 'css' | 'xpath',
            attribute: r.attribute || 'text',
            transformType: r.transformType as 'trim' | 'regex' | 'date' | 'number' | 'json' | 'custom' | undefined,
            dataType: (r.dataType || 'string') as 'string' | 'number' | 'date' | 'boolean' | 'json',
            isRequired: r.isRequired || false,
          }));
        
        setRules([...rules, ...newRules]);
        toast.success(`Added ${newRules.length} suggested mappings`);
      } else {
        toast.info('No mapping suggestions found');
      }
    } else {
      toast.error(response.error || 'Failed to get suggestions');
    }
    
    setIsSuggesting(false);
  }

  async function handleSaveRules() {
    setIsSaving(true);
    const response = await updateExtractionRules(id, rules);
    
    if (response.success) {
      toast.success('Extraction rules saved');
      fetchAssignment(); // Refresh
    } else {
      toast.error(response.error || 'Failed to save rules');
    }
    
    setIsSaving(false);
  }

  async function handleRunSampleTest() {
    setIsTesting(true);
    setTestResults(null);

    // Save rules first if in selector mode
    if (assignment?.extractionMethod !== 'llm') {
      await updateExtractionRules(id, rules);
    }

    const response = await runSampleTest(id, 5);

    if (response.success && response.data) {
      if (response.data.error || !response.data.rows || response.data.rows.length === 0) {
        // Test ran but failed or returned no data
        setTestResults({
          rows: response.data.rows || [],
          columns: response.data.columns,
          error: response.data.error || (response.data.rows?.length === 0 ? 'No data extracted. Check your selectors or capture configuration.' : undefined),
          sourceUrl: response.data.sourceUrl,
        });
        if (response.data.error) {
          toast.error('Test failed — see details below');
        } else {
          toast.info('No data extracted — see details below');
        }
      } else {
        setTestResults({
          rows: response.data.rows,
          columns: response.data.columns,
          sourceUrl: response.data.sourceUrl,
        });
        toast.success(`Extracted ${response.data.rows.length} sample rows`);
      }
    } else {
      // API call itself failed
      setTestResults({
        rows: [],
        error: response.error || 'Sample test failed — could not connect to the API',
      });
      toast.error('Test failed — see details below');
    }

    setIsTesting(false);
  }

  async function handleRunExtraction() {
    setIsRunning(true);
    
    const response = await triggerExtraction(id, assignment?.syncMode as 'manual' | 'auto');
    
    if (response.success && response.data) {
      toast.success('Extraction started');
      router.push(`/extraction-jobs/${response.data.jobId}`);
    } else {
      toast.error(response.error || 'Failed to start extraction');
    }
    
    setIsRunning(false);
  }

  async function handleDelete() {
    const response = await deleteAssignment(id);
    if (response.success) {
      toast.success('Assignment deleted');
      router.push('/assignments');
    } else {
      toast.error(response.error || 'Failed to delete');
    }
  }

  async function handleLLMAnalyze() {
    setIsLLMAnalyzing(true);
    setLlmAnalysisResult(null);

    const response = await llmAnalyze(id);

    if (response.success && response.data) {
      setLlmAnalysisResult(response.data.result);
      toast.success(`Found data for ${response.data.result.summary.availableColumns} of ${response.data.result.summary.totalColumns} columns`);
    } else {
      toast.error(response.error || 'LLM analysis failed');
    }

    setIsLLMAnalyzing(false);
  }

  async function handleCreateCapture() {
    if (!llmAnalysisResult) return;
    setIsCreatingCapture(true);

    const response = await llmCreateCapture(id, llmAnalysisResult.columns);

    if (response.success) {
      toast.success(response.data?.message || 'Structured capture created');
      fetchAssignment(); // Refresh to show updated extraction method
      setLlmAnalysisResult(null);
    } else {
      toast.error(response.error || 'Failed to create structured capture');
    }

    setIsCreatingCapture(false);
  }

  function addRule() {
    setRules([...rules, {
      targetColumn: '',
      selector: '',
      selectorType: 'css',
      attribute: 'text',
      dataType: 'string',
      isRequired: false,
    }]);
  }

  function updateRule(index: number, field: keyof ExtractionRuleFormData, value: unknown) {
    const newRules = [...rules];
    (newRules[index] as Record<string, unknown>)[field] = value;
    setRules(newRules);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  if (isLoading) {
    return (
      <>
        <Header title="Assignment" />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!assignment) return null;

  const status = statusConfig[assignment.status] || statusConfig.draft;

  return (
    <>
      <Header
        title={assignment.name}
        description={`${assignment.webSource?.name} → ${assignment.targetTable}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/assignments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/10">
                    <GitBranch className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <CardTitle>{assignment.name}</CardTitle>
                    <CardDescription>{assignment.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={status.className}>{status.label}</Badge>
                  <Badge variant="outline">
                    {assignment.syncMode === 'manual' ? 'Manual' : 'Auto'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                  <Globe className="h-8 w-8 text-purple-400" />
                  <div>
                    <p className="font-medium">{assignment.webSource?.name}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {assignment.startUrl || assignment.webSource?.baseUrl}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                  <Database className="h-8 w-8 text-blue-400" />
                  <div>
                    <p className="font-medium">{assignment.dataSource?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.targetSchema}.{assignment.targetTable}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Run & Test</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test extraction with a sample or run a full extraction job
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRunSampleTest}
                    disabled={isTesting || (assignment.extractionMethod !== 'llm' && rules.length === 0)}
                  >
                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                    Test Sample
                  </Button>
                  <Button
                    onClick={handleRunExtraction}
                    disabled={isRunning || (assignment.extractionMethod !== 'llm' && rules.length === 0)}
                  >
                    {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Run Extraction
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          {testResults && (
            <Card className={testResults.error ? 'border-destructive/50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {testResults.error ? (
                      <>
                        <XCircle className="h-5 w-5 text-destructive" />
                        Sample Test Failed
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        Sample Test Results
                      </>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {testResults.rows.length > 0 && (
                      <div className="flex items-center gap-0.5 rounded-md border p-0.5 mr-2">
                        <Button
                          variant={testViewMode === 'table' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setTestViewMode('table')}
                          className="h-6 px-2"
                          title="Table view"
                        >
                          <Rows3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={testViewMode === 'detail' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setTestViewMode('detail')}
                          className="h-6 px-2"
                          title="Detail view"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setTestResults(null)} className="h-7 px-2 text-xs text-muted-foreground">
                      Dismiss
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {testResults.error
                    ? 'The test encountered an error'
                    : `${testResults.rows.length} rows extracted`}
                  {testResults.sourceUrl && (
                    <span className="block text-xs mt-1 font-mono truncate">{testResults.sourceUrl}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testResults.error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-destructive">Error Details</p>
                        <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-mono break-all">
                          {testResults.error}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {testResults.rows.length > 0 && testViewMode === 'table' && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {(testResults.columns || Object.keys(testResults.rows[0] || {})).map(col => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testResults.rows.map((row, i) => (
                          <TableRow
                            key={i}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedRowIndex(i)}
                          >
                            {(testResults.columns || Object.keys(row)).map(col => (
                              <TableCell key={col} className="max-w-[200px] truncate">
                                {String(row[col] ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-[11px] text-muted-foreground mt-2">Click a row to view full details</p>
                  </div>
                )}

                {testResults.rows.length > 0 && testViewMode === 'detail' && (
                  <div className="space-y-4">
                    {testResults.rows.map((row, i) => (
                      <div key={i} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">Row {i + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setSelectedRowIndex(i)}
                          >
                            <Maximize2 className="h-3 w-3 mr-1" />
                            Expand
                          </Button>
                        </div>
                        {(testResults.columns || Object.keys(row)).map(col => (
                          <div key={col} className="grid grid-cols-[140px_1fr] gap-2 items-start">
                            <span className="text-xs font-medium text-muted-foreground truncate">{col}</span>
                            <span className="text-sm break-all">{String(row[col] ?? '')}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {!testResults.error && testResults.rows.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No rows extracted. Check your extraction rules or capture configuration.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Extraction Method Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extraction Method</CardTitle>
                  <CardDescription>How data is extracted from the website</CardDescription>
                </div>
                <Badge variant="outline" className={
                  assignment.extractionMethod === 'llm'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }>
                  {assignment.extractionMethod === 'llm' ? (
                    <><Brain className="mr-1 h-3 w-3" /> LLM Structured Output</>
                  ) : (
                    <><Search className="mr-1 h-3 w-3" /> CSS/XPath Selectors</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {assignment.extractionMethod === 'llm' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-purple-500/5 border-purple-500/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        <span className="font-medium text-sm">LLM Structured Capture Active</span>
                      </div>
                      {assignment.llmCaptureConfig && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCaptureConfig(!showCaptureConfig)}
                          className="h-7 px-2 text-xs"
                        >
                          {showCaptureConfig ? (
                            <><ChevronUp className="mr-1 h-3 w-3" /> Hide Config</>
                          ) : (
                            <><Eye className="mr-1 h-3 w-3" /> View Config</>
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This assignment uses AI-powered extraction. The LLM analyzes each page and returns structured data matching your database schema.
                      {assignment.llmCaptureConfig && (() => {
                        try {
                          const config: LLMCaptureConfig = JSON.parse(assignment.llmCaptureConfig);
                          return ` Capturing ${config.columnMappings.length} columns using ${config.model}.`;
                        } catch {
                          return '';
                        }
                      })()}
                    </p>
                  </div>

                  {/* Capture Config Detailed View */}
                  {showCaptureConfig && assignment.llmCaptureConfig && (() => {
                    try {
                      const config: LLMCaptureConfig = JSON.parse(assignment.llmCaptureConfig);
                      return (
                        <div className="space-y-4 rounded-lg border p-4 max-h-[60vh] overflow-y-auto">
                          {/* Model & Temperature */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Model:</span>
                              <Badge variant="outline" className="text-xs">{config.model}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Temperature:</span>
                              <Badge variant="outline" className="text-xs">{config.temperature}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Columns:</span>
                              <Badge variant="outline" className="text-xs">{config.columnMappings.length}</Badge>
                            </div>
                          </div>

                          {/* Column Mappings */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="h-3.5 w-3.5 text-blue-400" />
                              <span className="text-sm font-medium">Column Mappings</span>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">DB Column</TableHead>
                                    <TableHead className="text-xs">JSON Field</TableHead>
                                    <TableHead className="text-xs">Type</TableHead>
                                    <TableHead className="text-xs">Required</TableHead>
                                    <TableHead className="text-xs">Description</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {config.columnMappings.map((mapping) => (
                                    <TableRow key={mapping.columnName}>
                                      <TableCell className="text-xs font-mono">{mapping.columnName}</TableCell>
                                      <TableCell className="text-xs font-mono">{mapping.jsonField}</TableCell>
                                      <TableCell className="text-xs">
                                        <Badge variant="outline" className="text-[10px] px-1.5">{mapping.dataType}</Badge>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {mapping.isRequired ? (
                                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                        {mapping.description}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* System Prompt */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="h-3.5 w-3.5 text-purple-400" />
                              <span className="text-sm font-medium">System Prompt</span>
                            </div>
                            <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono">
                              {config.systemPrompt}
                            </pre>
                          </div>

                          {/* JSON Schema */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Code className="h-3.5 w-3.5 text-amber-400" />
                              <span className="text-sm font-medium">JSON Schema</span>
                            </div>
                            <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono">
                              {JSON.stringify(config.jsonSchema, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    } catch {
                      return (
                        <div className="text-sm text-muted-foreground">
                          Unable to parse capture configuration.
                        </div>
                      );
                    }
                  })()}

                  <Button variant="outline" size="sm" onClick={handleLLMAnalyze} disabled={isLLMAnalyzing}>
                    {isLLMAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                    Re-analyze with LLM
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Using CSS/XPath selectors to extract data. You can switch to LLM-based extraction by running an LLM analysis from the web source.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleLLMAnalyze} disabled={isLLMAnalyzing}>
                    {isLLMAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                    Try LLM Analysis
                  </Button>
                </div>
              )}

              {/* LLM Analysis Results (inline) */}
              {llmAnalysisResult && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium">
                      LLM found data for {llmAnalysisResult.summary.availableColumns} of {llmAnalysisResult.summary.totalColumns} columns
                    </span>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {llmAnalysisResult.columns.map((col) => (
                      <div key={col.columnName} className="flex items-center gap-2 text-sm py-1">
                        {col.isAvailable ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className={col.isAvailable ? '' : 'text-muted-foreground'}>{col.columnName}</span>
                        {col.sampleValue && (
                          <span className="text-xs text-muted-foreground truncate">— &quot;{col.sampleValue}&quot;</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCreateCapture} disabled={isCreatingCapture || llmAnalysisResult.summary.availableColumns === 0}>
                    {isCreatingCapture ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Create Structured Capture
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extraction Rules */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extraction Rules</CardTitle>
                  <CardDescription>Define how to extract data from the website (selector mode)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSuggestMappings} disabled={isSuggesting}>
                    {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    AI Suggest
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRule}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                  <Button size="sm" onClick={handleSaveRules} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Explanation Section */}
              <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-muted">
                <p className="text-sm font-medium mb-2">How Extraction Rules Work</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Each rule tells the scraper how to find and extract one piece of data from the webpage. 
                  Think of it as giving directions: &quot;Find this element, take this value, and save it here.&quot;
                </p>
                <div className="grid gap-2 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <span className="font-medium text-foreground min-w-[100px]">Target Column:</span>
                    <span>The database column where the extracted data will be saved (e.g., &quot;product_name&quot;, &quot;price&quot;)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-foreground min-w-[100px]">CSS Selector:</span>
                    <span>The pattern to find elements on the page (e.g., &quot;.product-title&quot; for class, &quot;#price&quot; for ID, &quot;h1&quot; for tag)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-foreground min-w-[100px]">Attribute:</span>
                    <span>What to extract — Text (visible content), Href (link URL), Src (image URL), or HTML (raw markup)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-foreground min-w-[100px]">Data Type:</span>
                    <span>How to format the value — String (text), Number (numeric), Date (datetime), Boolean (true/false)</span>
                  </div>
                </div>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No extraction rules configured.</p>
                  <p className="text-sm mt-1">Click &quot;AI Suggest&quot; to auto-generate rules or &quot;Add Rule&quot; to create manually.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 border rounded-lg bg-muted/30">
                      <div className="flex-1 grid gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Target Column</Label>
                          <Input
                            value={rule.targetColumn}
                            onChange={(e) => updateRule(index, 'targetColumn', e.target.value)}
                            placeholder="column_name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CSS Selector</Label>
                          <Input
                            value={rule.selector}
                            onChange={(e) => updateRule(index, 'selector', e.target.value)}
                            placeholder=".class or #id"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Attribute</Label>
                          <Select
                            value={rule.attribute}
                            onValueChange={(v) => updateRule(index, 'attribute', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="href">Href</SelectItem>
                              <SelectItem value="src">Src</SelectItem>
                              <SelectItem value="html">HTML</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Data Type</Label>
                          <Select
                            value={rule.dataType}
                            onValueChange={(v) => updateRule(index, 'dataType', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeRule(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          {assignment.extractionJobs && assignment.extractionJobs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Jobs</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/assignments/${id}/jobs`}>View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assignment.extractionJobs.slice(0, 5).map((job) => (
                    <Link
                      key={job.id}
                      href={`/extraction-jobs/${job.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          job.status === 'completed' ? 'text-emerald-400' :
                          job.status === 'failed' ? 'text-red-400' :
                          job.status === 'running' ? 'text-blue-400' :
                          'text-muted-foreground'
                        }>
                          {job.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {job.id.slice(0, 8)}...
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                Delete Assignment
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Row Detail Dialog */}
      <Dialog open={selectedRowIndex !== null} onOpenChange={(open) => { if (!open) setSelectedRowIndex(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Row {selectedRowIndex !== null ? selectedRowIndex + 1 : ''} Details</DialogTitle>
            <DialogDescription>
              {testResults?.rows && selectedRowIndex !== null && testResults.rows.length > 1 && (
                `Row ${selectedRowIndex + 1} of ${testResults.rows.length}`
              )}
            </DialogDescription>
          </DialogHeader>
          {testResults?.rows && selectedRowIndex !== null && testResults.rows[selectedRowIndex] && (
            <>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3 pr-4">
                  {(testResults.columns || Object.keys(testResults.rows[selectedRowIndex])).map(col => {
                    const value = testResults.rows[selectedRowIndex!][col];
                    const displayValue = value === null || value === undefined ? '' : String(value);
                    return (
                      <div key={col} className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">{col}</label>
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm break-all whitespace-pre-wrap min-h-[36px]">
                          {displayValue || <span className="text-muted-foreground italic">empty</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {testResults.rows.length > 1 && (
                <div className="flex items-center justify-between border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedRowIndex === 0}
                    onClick={() => setSelectedRowIndex(Math.max(0, (selectedRowIndex ?? 0) - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {selectedRowIndex + 1} / {testResults.rows.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedRowIndex === testResults.rows.length - 1}
                    onClick={() => setSelectedRowIndex(Math.min(testResults.rows.length - 1, (selectedRowIndex ?? 0) + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this assignment and all its extraction rules and job history.
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
