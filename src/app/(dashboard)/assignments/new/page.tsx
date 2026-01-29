'use client';

import { useEffect, useState } from 'react';
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
import { ArrowLeft, GitBranch, Loader2, Database, Globe } from 'lucide-react';
import Link from 'next/link';
import { createAssignment, getDataSources, getWebSources, getDataSourceTables } from '@/lib/api';
import { toast } from 'sonner';
import type { DataSource, WebSource, AssignmentFormData } from '@/types';

export default function NewAssignmentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [tables, setTables] = useState<{ schema: string; table: string }[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  const [formData, setFormData] = useState<AssignmentFormData>({
    name: '',
    description: '',
    dataSourceId: '',
    webSourceId: '',
    targetTable: '',
    targetSchema: 'public',
    syncMode: 'manual',
    scheduleType: 'manual',
    startUrl: '',
  });

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    const [dsResponse, wsResponse] = await Promise.all([
      getDataSources(),
      getWebSources(),
    ]);
    
    if (dsResponse.success && dsResponse.data) {
      setDataSources(dsResponse.data);
    }
    if (wsResponse.success && wsResponse.data) {
      setWebSources(wsResponse.data);
    }
  }

  async function handleDataSourceChange(dataSourceId: string) {
    setFormData({ ...formData, dataSourceId, targetTable: '' });
    setTables([]);
    
    if (dataSourceId) {
      setLoadingTables(true);
      const response = await getDataSourceTables(dataSourceId);
      if (response.success && response.data) {
        setTables(response.data.map(t => ({ schema: t.schema, table: t.table })));
      }
      setLoadingTables(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name || !formData.dataSourceId || !formData.webSourceId || !formData.targetTable) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    const response = await createAssignment(formData);
    
    if (response.success && response.data) {
      toast.success('Assignment created successfully');
      router.push(`/assignments/${response.data.id}`);
    } else {
      toast.error(response.error || 'Failed to create assignment');
    }
    
    setIsLoading(false);
  }

  const selectedWebSource = webSources.find(ws => ws.id === formData.webSourceId);

  return (
    <>
      <Header
        title="New Assignment"
        description="Link a website to a database table"
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
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/10">
                  <GitBranch className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Name and describe your assignment</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Product Scraper"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this assignment does"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source & Target</CardTitle>
              <CardDescription>Configure where data comes from and where it goes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webSourceId" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Web Source *
                  </Label>
                  <Select
                    value={formData.webSourceId}
                    onValueChange={(value) => {
                      const ws = webSources.find(w => w.id === value);
                      setFormData({ 
                        ...formData, 
                        webSourceId: value,
                        startUrl: ws?.baseUrl || ''
                      });
                    }}
                  >
                    <SelectTrigger id="webSourceId">
                      <SelectValue placeholder="Select web source" />
                    </SelectTrigger>
                    <SelectContent>
                      {webSources.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataSourceId" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Database *
                  </Label>
                  <Select
                    value={formData.dataSourceId}
                    onValueChange={handleDataSourceChange}
                  >
                    <SelectTrigger id="dataSourceId">
                      <SelectValue placeholder="Select database" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataSources.map(ds => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name} ({ds.dbType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetTable">Target Table *</Label>
                <Select
                  value={formData.targetTable ? `${formData.targetSchema}.${formData.targetTable}` : ''}
                  onValueChange={(value) => {
                    const [schema, table] = value.split('.');
                    setFormData({ ...formData, targetTable: table, targetSchema: schema });
                  }}
                  disabled={!formData.dataSourceId || loadingTables}
                >
                  <SelectTrigger id="targetTable">
                    <SelectValue placeholder={loadingTables ? 'Loading tables...' : 'Select target table'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map(t => (
                      <SelectItem key={`${t.schema}.${t.table}`} value={`${t.schema}.${t.table}`}>
                        {t.schema}.{t.table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startUrl">Start URL</Label>
                <Input
                  id="startUrl"
                  type="url"
                  placeholder={selectedWebSource?.baseUrl || 'https://example.com/products'}
                  value={formData.startUrl || ''}
                  onChange={(e) => setFormData({ ...formData, startUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the web source's base URL
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Mode</CardTitle>
              <CardDescription>Choose how data is synced</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="syncMode">Sync Mode</Label>
                  <Select
                    value={formData.syncMode}
                    onValueChange={(value) => setFormData({ ...formData, syncMode: value as 'manual' | 'auto' })}
                  >
                    <SelectTrigger id="syncMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual (Review before commit)</SelectItem>
                      <SelectItem value="auto">Auto (Direct to database)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.syncMode === 'manual' 
                      ? 'Data is staged as JSON for review before committing'
                      : 'Data is inserted directly into the database'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduleType">Schedule</Label>
                  <Select
                    value={formData.scheduleType}
                    onValueChange={(value) => setFormData({ ...formData, scheduleType: value as 'manual' | 'hourly' | 'daily' | 'weekly' })}
                  >
                    <SelectTrigger id="scheduleType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/assignments">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Assignment
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}
