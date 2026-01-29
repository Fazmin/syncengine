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
import { ArrowLeft, Globe, Loader2, Zap, Search, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getWebSource, updateWebSource, testWebSourceConnection, analyzeWebSource } from '@/lib/api';
import { toast } from 'sonner';
import type { WebSource, WebSourceFormData } from '@/types';

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
    const response = await analyzeWebSource(id);
    
    if (response.success && response.data) {
      const structure = response.data.structure;
      toast.success(`Found ${structure?.repeatingElements?.length || 0} data patterns`);
      setWebSource(prev => prev ? { 
        ...prev, 
        lastAnalyzedAt: new Date(),
        paginationType: structure?.pagination?.type || prev.paginationType,
      } : null);
    } else {
      toast.error('Failed to analyze website');
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
    </>
  );
}
