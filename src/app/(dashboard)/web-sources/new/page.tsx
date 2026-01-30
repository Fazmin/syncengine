'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Globe, Loader2, List, Link2 } from 'lucide-react';
import Link from 'next/link';
import { createWebSource } from '@/lib/api';
import { toast } from 'sonner';
import type { WebSourceFormData } from '@/types';

export default function NewWebSourcePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isListMode, setIsListMode] = useState(false);
  const [urlListText, setUrlListText] = useState('');
  const [formData, setFormData] = useState<WebSourceFormData>({
    name: '',
    baseUrl: '',
    description: '',
    scraperType: 'hybrid',
    authType: 'none',
    requestDelay: 1000,
    maxConcurrent: 1,
  });

  // Parse URL list from text (comma-separated or one per line)
  function parseUrlList(text: string): string[] {
    const urls = text
      .split(/[,\n]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
    return urls;
  }

  // Validate a URL
  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    if (isListMode) {
      // Parse and validate URL list
      const urls = parseUrlList(urlListText);
      
      if (urls.length === 0) {
        toast.error('Please enter at least one URL');
        return;
      }

      // Validate all URLs
      const invalidUrls = urls.filter(url => !isValidUrl(url));
      if (invalidUrls.length > 0) {
        toast.error(`Invalid URL(s): ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`);
        return;
      }

      // First URL becomes baseUrl, rest go to urlList
      const [baseUrl, ...additionalUrls] = urls;
      
      setIsLoading(true);
      
      const response = await createWebSource({
        ...formData,
        baseUrl,
        isListMode: true,
        urlList: additionalUrls.length > 0 ? JSON.stringify(additionalUrls) : undefined,
      });
      
      if (response.success && response.data) {
        toast.success(`Web source created with ${urls.length} URL(s)`);
        router.push('/web-sources');
      } else {
        toast.error(response.error || 'Failed to create web source');
      }
      
      setIsLoading(false);
    } else {
      // Single URL mode
      if (!formData.baseUrl) {
        toast.error('URL is required');
        return;
      }

      // Validate URL
      if (!isValidUrl(formData.baseUrl)) {
        toast.error('Please enter a valid URL');
        return;
      }

      setIsLoading(true);
      
      const response = await createWebSource({
        ...formData,
        isListMode: false,
      });
      
      if (response.success && response.data) {
        toast.success('Web source created successfully');
        router.push('/web-sources');
      } else {
        toast.error(response.error || 'Failed to create web source');
      }
      
      setIsLoading(false);
    }
  }

  return (
    <>
      <Header
        title="Add Web Source"
        description="Configure a new website to scrape data from"
        actions={
          <Button variant="outline" asChild>
            <Link href="/web-sources">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/10">
                  <Globe className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Enter the website details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="My Website"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* List Mode Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="listMode" className="font-medium">List Mode</Label>
                    {isListMode && (
                      <Badge variant="secondary" className="text-xs">
                        {parseUrlList(urlListText).length} URL(s)
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter multiple URLs with the same structure. Analysis will learn from the first URL and apply rules to all.
                  </p>
                </div>
                <Switch
                  id="listMode"
                  checked={isListMode}
                  onCheckedChange={setIsListMode}
                />
              </div>

              {isListMode ? (
                <div className="space-y-2">
                  <Label htmlFor="urlList">URL List *</Label>
                  <Textarea
                    id="urlList"
                    placeholder={"https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3\n\nOr comma-separated:\nhttps://example.com/page1, https://example.com/page2"}
                    value={urlListText}
                    onChange={(e) => setUrlListText(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one URL per line, or separate with commas. The first URL will be used for analysis.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL *</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What data will you extract from this website?"
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
              <CardDescription>Configure how to scrape this website</CardDescription>
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
                      <SelectItem value="hybrid">Hybrid (Recommended)</SelectItem>
                      <SelectItem value="http">HTTP Only (Fast)</SelectItem>
                      <SelectItem value="browser">Browser (JavaScript)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Hybrid tries HTTP first, falls back to browser for dynamic pages
                  </p>
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
                    max={60000}
                    value={formData.requestDelay}
                    onChange={(e) => setFormData({ ...formData, requestDelay: parseInt(e.target.value) || 1000 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay between requests to avoid rate limiting
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxConcurrent">Max Concurrent Requests</Label>
                  <Input
                    id="maxConcurrent"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.maxConcurrent}
                    onChange={(e) => setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of simultaneous requests
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/web-sources">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Web Source
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}
