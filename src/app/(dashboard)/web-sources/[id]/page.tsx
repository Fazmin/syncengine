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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Globe, Loader2, Zap, Search, CheckCircle2, XCircle, AlertCircle, List } from 'lucide-react';
import Link from 'next/link';
import { getWebSource, updateWebSource, testWebSourceConnection, analyzeWebSource } from '@/lib/api';
import { toast } from 'sonner';
import type { WebSource, WebSourceFormData, WebsiteStructure } from '@/types';

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

export default function EditWebSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [webSource, setWebSource] = useState<WebSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<Partial<WebSourceFormData>>({});
  const [analysisResults, setAnalysisResults] = useState<WebsiteStructure | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

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
    setIsAnalyzing(true);
    setAnalysisResults(null);
    setShowAnalysisDialog(true); // Show dialog immediately in loading state
    
    const response = await analyzeWebSource(id);
    
    if (response.success && response.data) {
      const structure = response.data.structure;
      
      // Populate the dialog with results
      if (structure) {
        setAnalysisResults(structure);
      }
      
      toast.success(`Found ${structure?.repeatingElements?.length || 0} data patterns`);
      setWebSource(prev => prev ? { 
        ...prev, 
        lastAnalyzedAt: new Date(),
        paginationType: structure?.pagination?.type || prev.paginationType,
      } : null);
    } else {
      toast.error(response.error || 'Failed to analyze website');
      setShowAnalysisDialog(false); // Close dialog on error
    }
    
    setIsAnalyzing(false);
  }

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
            <Button variant="outline" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
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

      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { setShowAnalysisDialog(open); if (!open) setAnalysisResults(null); }}>
        <DialogContent className="w-[80vw] max-w-[1400px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Analysis Results: {webSource?.name}</DialogTitle>
            <DialogDescription>
              {isAnalyzing ? 'Analyzing website structure...' : `Detected data patterns and page structure from ${analysisResults?.url}`}
            </DialogDescription>
          </DialogHeader>
          
          {isAnalyzing ? (
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
                  {analysisResults?.pagination && (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Pagination Detected</Badge>
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium">Type:</span> {analysisResults.pagination.type}</p>
                        {analysisResults.pagination.paramName && (
                          <p><span className="font-medium">Parameter:</span> {analysisResults.pagination.paramName}</p>
                        )}
                        {analysisResults.pagination.selector && (
                          <p><span className="font-medium">Selector:</span> <code className="bg-muted px-1 rounded">{analysisResults.pagination.selector}</code></p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Repeating Elements */}
                  {analysisResults?.repeatingElements && analysisResults.repeatingElements.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="font-medium">Data Patterns Found ({analysisResults.repeatingElements.length})</h4>
                      {analysisResults.repeatingElements.map((element, index) => (
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
                  {analysisResults?.forms && analysisResults.forms.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Forms Found ({analysisResults.forms.length})</h4>
                      {analysisResults.forms.map((form, index) => (
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
                  {JSON.stringify(analysisResults, null, 2)}
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
