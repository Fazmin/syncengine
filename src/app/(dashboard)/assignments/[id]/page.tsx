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
} from 'lucide-react';
import { 
  getAssignment, 
  updateAssignment, 
  deleteAssignment,
  suggestMappings, 
  updateExtractionRules, 
  runSampleTest,
  triggerExtraction,
} from '@/lib/api';
import type { Assignment, ExtractionRule, ExtractionRuleFormData } from '@/types';
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
  const [testResults, setTestResults] = useState<{ rows: Record<string, unknown>[]; columns?: string[] } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    
    // Save rules first
    await updateExtractionRules(id, rules);
    
    const response = await runSampleTest(id, 5);
    
    if (response.success && response.data) {
      setTestResults({
        rows: response.data.rows,
        columns: response.data.columns,
      });
      if (response.data.rows.length > 0) {
        toast.success(`Extracted ${response.data.rows.length} sample rows`);
      } else {
        toast.info('No data extracted - check your selectors');
      }
    } else {
      toast.error(response.data?.error || 'Sample test failed');
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRunSampleTest} disabled={isTesting || rules.length === 0}>
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Test
            </Button>
            <Button onClick={handleRunExtraction} disabled={isRunning || rules.length === 0}>
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Extraction
            </Button>
            <Button variant="outline" asChild>
              <Link href="/assignments">
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

          {/* Extraction Rules */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extraction Rules</CardTitle>
                  <CardDescription>Define how to extract data from the website</CardDescription>
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

          {/* Test Results */}
          {testResults && testResults.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Sample Test Results
                </CardTitle>
                <CardDescription>{testResults.rows.length} rows extracted</CardDescription>
              </CardHeader>
              <CardContent>
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
                        <TableRow key={i}>
                          {(testResults.columns || Object.keys(row)).map(col => (
                            <TableCell key={col} className="max-w-[200px] truncate">
                              {String(row[col] ?? '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

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
