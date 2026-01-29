'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  Play, 
  Database, 
  Table2, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { getSyncConfig, updateSyncConfig, triggerSync, getSyncJobs } from '@/lib/api';
import type { SyncConfig, SyncJob, SyncMode, ScheduleType, TableConfig } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const scheduleOptions: { value: ScheduleType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'cron', label: 'Custom (Cron)' },
];

function JobStatusBadge({ status }: { status: string }) {
  const config = {
    completed: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400' },
    running: { icon: Loader2, className: 'bg-blue-500/20 text-blue-400' },
    failed: { icon: XCircle, className: 'bg-red-500/20 text-red-400' },
    pending: { icon: Clock, className: 'bg-amber-500/20 text-amber-400' },
    cancelled: { icon: XCircle, className: 'bg-slate-500/20 text-slate-400' },
  }[status] || { icon: AlertCircle, className: 'bg-slate-500/20 text-slate-400' };

  const Icon = config.icon;

  return (
    <Badge className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  );
}

export default function EditSyncConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig & { tableConfigs?: TableConfig[] } | null>(null);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    syncMode: 'full' as SyncMode,
    scheduleType: 'manual' as ScheduleType,
    cronExpression: '',
    outputPath: './output',
    outputFileName: 'sync_data.db',
    compressOutput: false,
    encryptOutput: false,
    isActive: true,
  });

  useEffect(() => {
    async function fetchData() {
      const [configResponse, jobsResponse] = await Promise.all([
        getSyncConfig(id),
        getSyncJobs(id)
      ]);
      
      if (configResponse.success && configResponse.data) {
        const config = configResponse.data;
        setSyncConfig(config);
        setFormData({
          name: config.name,
          description: config.description || '',
          syncMode: config.syncMode as SyncMode,
          scheduleType: config.scheduleType as ScheduleType,
          cronExpression: config.cronExpression || '',
          outputPath: config.outputPath,
          outputFileName: config.outputFileName,
          compressOutput: config.compressOutput,
          encryptOutput: config.encryptOutput,
          isActive: config.isActive,
        });
      } else {
        toast.error('Sync configuration not found');
        router.push('/sync-configs');
      }
      
      if (jobsResponse.success && jobsResponse.data) {
        setJobs(jobsResponse.data);
      }
      
      setIsLoading(false);
    }
    fetchData();
  }, [id, router]);

  function updateField<K extends keyof typeof formData>(key: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const response = await updateSyncConfig(id, formData);

    if (response.success) {
      toast.success('Configuration updated successfully');
    } else {
      toast.error(response.error || 'Failed to update configuration');
    }

    setIsSubmitting(false);
  }

  async function handleRun() {
    setIsRunning(true);
    const response = await triggerSync(id);
    
    if (response.success && response.data) {
      toast.success('Sync job started');
      setJobs((prev) => [response.data!, ...prev]);
    } else {
      toast.error(response.error || 'Failed to start sync');
    }
    
    setIsRunning(false);
  }

  if (isLoading) {
    return (
      <>
        <Header title="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title={syncConfig?.name || 'Edit Configuration'}
        description="Manage sync configuration settings"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleRun} disabled={isRunning || !formData.isActive}>
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Now
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/sync-configs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="settings" className="mx-auto max-w-4xl">
          <TabsList className="mb-6">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="tables">Tables ({syncConfig?.tableConfigs?.length || 0})</TabsTrigger>
            <TabsTrigger value="jobs">Job History ({jobs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Status */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {syncConfig?.dataSource?.name || 'Unknown Data Source'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {syncConfig?.tableConfigs?.length || 0} tables configured
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="isActive" className="text-sm">Active</Label>
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => updateField('isActive', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sync Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Sync Settings</CardTitle>
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
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Output Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Output Settings</CardTitle>
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

                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="compress"
                        checked={formData.compressOutput}
                        onCheckedChange={(c) => updateField('compressOutput', c)}
                      />
                      <Label htmlFor="compress">Compress</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="encrypt"
                        checked={formData.encryptOutput}
                        onCheckedChange={(c) => updateField('encryptOutput', c)}
                      />
                      <Label htmlFor="encrypt">Encrypt</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="tables">
            <Card>
              <CardHeader>
                <CardTitle>Configured Tables</CardTitle>
                <CardDescription>Tables and columns selected for synchronization</CardDescription>
              </CardHeader>
              <CardContent>
                {!syncConfig?.tableConfigs || syncConfig.tableConfigs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No tables configured
                  </div>
                ) : (
                  <div className="space-y-4">
                    {syncConfig.tableConfigs.map((table) => (
                      <div key={table.id} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <Table2 className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline">{table.sourceSchema}</Badge>
                          <span className="font-medium">{table.sourceTable}</span>
                          {table.columnConfigs && (
                            <Badge variant="secondary">
                              {table.columnConfigs.filter((c) => c.isIncluded).length} columns
                            </Badge>
                          )}
                          {!table.isActive && (
                            <Badge variant="outline" className="text-amber-500">Disabled</Badge>
                          )}
                        </div>
                        {table.whereClause && (
                          <p className="mt-2 text-xs text-muted-foreground font-mono">
                            WHERE {table.whereClause}
                          </p>
                        )}
                        {table.columnConfigs && table.columnConfigs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {table.columnConfigs.filter((c) => c.isIncluded).map((col) => (
                              <Badge
                                key={col.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {col.sourceColumn}
                                {col.maskingType !== 'none' && (
                                  <span className="ml-1 text-amber-500">
                                    [{col.maskingType}]
                                  </span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Job History</CardTitle>
                <CardDescription>Recent sync job executions</CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No jobs have been run yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center gap-4">
                          <JobStatusBadge status={job.status} />
                          <div>
                            <p className="font-medium">
                              {format(new Date(job.createdAt), 'MMM d, yyyy HH:mm')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {job.triggeredBy} •{' '}
                              {job.completedAt
                                ? `Completed ${formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}`
                                : 'In progress'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          {job.status === 'completed' && (
                            <>
                              <p>{job.rowsProcessed.toLocaleString()} rows</p>
                              <p className="text-xs text-muted-foreground">
                                {job.tablesProcessed} tables
                              </p>
                            </>
                          )}
                          {job.status === 'failed' && job.errorMessage && (
                            <p className="text-xs text-red-400 max-w-[200px] truncate">
                              {job.errorMessage}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

