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
import { ArrowLeft, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createWebSource } from '@/lib/api';
import { toast } from 'sonner';
import type { WebSourceFormData } from '@/types';

export default function NewWebSourcePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<WebSourceFormData>({
    name: '',
    baseUrl: '',
    description: '',
    scraperType: 'hybrid',
    authType: 'none',
    requestDelay: 1000,
    maxConcurrent: 1,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name || !formData.baseUrl) {
      toast.error('Name and URL are required');
      return;
    }

    // Validate URL
    try {
      new URL(formData.baseUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    
    const response = await createWebSource(formData);
    
    if (response.success && response.data) {
      toast.success('Web source created successfully');
      router.push('/web-sources');
    } else {
      toast.error(response.error || 'Failed to create web source');
    }
    
    setIsLoading(false);
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
