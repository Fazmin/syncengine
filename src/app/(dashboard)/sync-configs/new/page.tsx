'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Database, Table2, RefreshCw } from 'lucide-react';
import { createSyncConfig, getDataSources, getDataSourceTables, updateTableConfigs } from '@/lib/api';
import type { DataSource, SyncMode, ScheduleType } from '@/types';
import { toast } from 'sonner';

const scheduleOptions: { value: ScheduleType; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual', description: 'Trigger sync manually' },
  { value: 'hourly', label: 'Hourly', description: 'Run every hour' },
  { value: 'daily', label: 'Daily', description: 'Run once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Run once per week' },
  { value: 'cron', label: 'Custom (Cron)', description: 'Use cron expression' },
];

function NewSyncConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDataSourceId = searchParams.get('dataSourceId');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(true);
  const [tables, setTables] = useState<{ schema: string; table: string; columns: { name: string; type: string; nullable?: boolean }[] }[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Map<string, { columns: Set<string> }>>(new Map());
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dataSourceId: preselectedDataSourceId || '',
    syncMode: 'full' as SyncMode,
    scheduleType: 'manual' as ScheduleType,
    cronExpression: '',
    outputPath: './output',
    outputFileName: 'sync_data.db',
    compressOutput: false,
    encryptOutput: false,
  });

  useEffect(() => {
    async function fetchDataSources() {
      const response = await getDataSources();
      if (response.success && response.data) {
        setDataSources(response.data);
      }
      setIsLoadingDataSources(false);
    }
    fetchDataSources();
  }, []);

  useEffect(() => {
    if (formData.dataSourceId) {
      loadTables(formData.dataSourceId);
    }
  }, [formData.dataSourceId]);

  async function loadTables(dataSourceId: string) {
    setIsLoadingTables(true);
    const response = await getDataSourceTables(dataSourceId);
    if (response.success && response.data) {
      setTables(response.data);
    }
    setIsLoadingTables(false);
  }

  function updateField<K extends keyof typeof formData>(key: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTable(tableKey: string, table: typeof tables[0]) {
    setSelectedTables((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(tableKey)) {
        newMap.delete(tableKey);
      } else {
        newMap.set(tableKey, { columns: new Set(table.columns.map((c) => c.name)) });
      }
      return newMap;
    });
  }

  function toggleColumn(tableKey: string, columnName: string, table: typeof tables[0]) {
    setSelectedTables((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(tableKey);
      
      if (existing) {
        const newColumns = new Set(existing.columns);
        if (newColumns.has(columnName)) {
          newColumns.delete(columnName);
          if (newColumns.size === 0) {
            newMap.delete(tableKey);
          } else {
            newMap.set(tableKey, { columns: newColumns });
          }
        } else {
          newColumns.add(columnName);
          newMap.set(tableKey, { columns: newColumns });
        }
      } else {
        newMap.set(tableKey, { columns: new Set([columnName]) });
      }
      
      return newMap;
    });
  }

  async function handleSubmit() {
    if (!formData.name || !formData.dataSourceId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedTables.size === 0) {
      toast.error('Please select at least one table');
      return;
    }

    setIsSubmitting(true);

    // Create sync config
    const configResponse = await createSyncConfig(formData);

    if (!configResponse.success || !configResponse.data) {
      toast.error(configResponse.error || 'Failed to create sync configuration');
      setIsSubmitting(false);
      return;
    }

    // Add table configurations
    const tableConfigData = Array.from(selectedTables.entries()).map(([key, data]) => {
      const [schema, table] = key.split('.');
      const tableInfo = tables.find((t) => `${t.schema}.${t.table}` === key);
      
      return {
        sourceSchema: schema,
        sourceTable: table,
        columns: tableInfo?.columns
          .filter((c) => data.columns.has(c.name))
          .map((c) => ({
            sourceColumn: c.name,
            dataType: c.type,
            isIncluded: true,
            maskingType: 'none',
          })) || []
      };
    });

    await updateTableConfigs(configResponse.data.id, tableConfigData);

    toast.success('Sync configuration created successfully');
    router.push('/sync-configs');
    setIsSubmitting(false);
  }

  return (
    <>
      <Header
        title="New Sync Configuration"
        description="Set up a new data synchronization"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/sync-configs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    step >= s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`mx-2 h-0.5 w-12 transition-colors ${
                      step > s ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Config */}
          {step === 1 && (
            <div className="space-y-6 animate-slide-up">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Name and configure your sync</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Configuration Name *</Label>
                    <Input
                      id="name"
                      placeholder="Daily Customer Sync"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this sync does..."
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Source *</Label>
                    {isLoadingDataSources ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading data sources...
                      </div>
                    ) : (
                      <Select
                        value={formData.dataSourceId}
                        onValueChange={(v) => updateField('dataSourceId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a data source" />
                        </SelectTrigger>
                        <SelectContent>
                          {dataSources.map((ds) => (
                            <SelectItem key={ds.id} value={ds.id}>
                              <span className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                {ds.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Settings</CardTitle>
                  <CardDescription>How and when to sync</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sync Mode</Label>
                      <Select
                        value={formData.syncMode}
                        onValueChange={(v) => updateField('syncMode', v as SyncMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Refresh</SelectItem>
                          <SelectItem value="incremental">Incremental</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Schedule</Label>
                      <Select
                        value={formData.scheduleType}
                        onValueChange={(v) => updateField('scheduleType', v as ScheduleType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scheduleOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {formData.scheduleType === 'cron' && (
                    <div className="space-y-2">
                      <Label htmlFor="cron">Cron Expression</Label>
                      <Input
                        id="cron"
                        placeholder="0 0 * * *"
                        value={formData.cronExpression}
                        onChange={(e) => updateField('cronExpression', e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Example: 0 0 * * * (daily at midnight)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.dataSourceId}
                >
                  Next: Select Tables
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Table Selection */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Select Tables & Columns</CardTitle>
                      <CardDescription>Choose which data to sync</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTables(formData.dataSourceId)}
                      disabled={isLoadingTables}
                    >
                      {isLoadingTables ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingTables ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : tables.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      No tables found. Make sure the data source is connected.
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {tables.map((table) => {
                          const tableKey = `${table.schema}.${table.table}`;
                          const isSelected = selectedTables.has(tableKey);
                          const selectedColumns = selectedTables.get(tableKey)?.columns || new Set();

                          return (
                            <div
                              key={tableKey}
                              className={`rounded-lg border p-4 transition-colors ${
                                isSelected ? 'border-primary bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleTable(tableKey, table)}
                                />
                                <div className="flex items-center gap-2">
                                  <Table2 className="h-4 w-4 text-muted-foreground" />
                                  <Badge variant="outline">{table.schema}</Badge>
                                  <span className="font-medium">{table.table}</span>
                                  {isSelected && (
                                    <Badge variant="secondary">
                                      {selectedColumns.size}/{table.columns.length} columns
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="ml-7 mt-3 flex flex-wrap gap-2">
                                  {table.columns.map((col) => (
                                    <Badge
                                      key={col.name}
                                      variant={selectedColumns.has(col.name) ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => toggleColumn(tableKey, col.name, table)}
                                    >
                                      {col.name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={selectedTables.size === 0}
                >
                  Next: Output Settings
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Output Settings */}
          {step === 3 && (
            <div className="space-y-6 animate-slide-up">
              <Card>
                <CardHeader>
                  <CardTitle>Output Settings</CardTitle>
                  <CardDescription>Configure the output SQLite file</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="outputPath">Output Directory</Label>
                      <Input
                        id="outputPath"
                        value={formData.outputPath}
                        onChange={(e) => updateField('outputPath', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outputFileName">File Name</Label>
                      <Input
                        id="outputFileName"
                        value={formData.outputFileName}
                        onChange={(e) => updateField('outputFileName', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label className="text-sm font-medium">Compress Output</Label>
                        <p className="text-xs text-muted-foreground">
                          Compress the SQLite file (gzip)
                        </p>
                      </div>
                      <Switch
                        checked={formData.compressOutput}
                        onCheckedChange={(c) => updateField('compressOutput', c)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label className="text-sm font-medium">Encrypt Output</Label>
                        <p className="text-xs text-muted-foreground">
                          Encrypt the SQLite file at rest
                        </p>
                      </div>
                      <Switch
                        checked={formData.encryptOutput}
                        onCheckedChange={(c) => updateField('encryptOutput', c)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Configuration:</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Source:</span>
                      <span className="font-medium">
                        {dataSources.find((d) => d.id === formData.dataSourceId)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tables Selected:</span>
                      <span className="font-medium">{selectedTables.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schedule:</span>
                      <span className="font-medium">
                        {scheduleOptions.find((s) => s.value === formData.scheduleType)?.label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Output:</span>
                      <span className="font-medium font-mono text-xs">
                        {formData.outputPath}/{formData.outputFileName}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function NewSyncConfigPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <NewSyncConfigContent />
    </Suspense>
  );
}

