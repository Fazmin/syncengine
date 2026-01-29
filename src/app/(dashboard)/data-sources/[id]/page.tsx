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
import { ArrowLeft, Loader2, Save, Zap, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { getDataSource, updateDataSource, testDataSourceConnection, getDataSourceTables } from '@/lib/api';
import type { DatabaseType, DataSource, SyncConfig } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const dbTypes: { value: DatabaseType; label: string; icon: string; defaultPort: number }[] = [
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', icon: '🐬', defaultPort: 3306 },
  { value: 'mssql', label: 'SQL Server', icon: '🪟', defaultPort: 1433 },
  { value: 'oracle', label: 'Oracle', icon: '🔶', defaultPort: 1521 },
];

export default function EditDataSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource & { syncConfigs?: SyncConfig[] } | null>(null);
  const [tables, setTables] = useState<{ schema: string; table: string; columns: { name: string; type: string }[] }[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dbType: 'postgresql' as DatabaseType,
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    sslEnabled: true,
    isActive: true,
  });

  useEffect(() => {
    async function fetchDataSource() {
      const response = await getDataSource(id);
      if (response.success && response.data) {
        setDataSource(response.data);
        setFormData({
          name: response.data.name,
          description: response.data.description || '',
          dbType: response.data.dbType as DatabaseType,
          host: response.data.host,
          port: response.data.port,
          database: response.data.database,
          username: response.data.username,
          password: response.data.password,
          sslEnabled: response.data.sslEnabled,
          isActive: response.data.isActive,
        });
      } else {
        toast.error('Data source not found');
        router.push('/data-sources');
      }
      setIsLoading(false);
    }
    fetchDataSource();
  }, [id, router]);

  function updateField<K extends keyof typeof formData>(key: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const response = await updateDataSource(id, formData);

    if (response.success) {
      toast.success('Data source updated successfully');
      if (response.data) {
        setDataSource((prev) => prev ? { ...prev, ...response.data } : null);
      }
    } else {
      toast.error(response.error || 'Failed to update data source');
    }

    setIsSubmitting(false);
  }

  async function handleTest() {
    setIsTesting(true);
    const response = await testDataSourceConnection(id);
    
    if (response.success && response.data) {
      const { status, message } = response.data;
      setDataSource((prev) => prev ? { ...prev, connectionStatus: status, lastTestedAt: new Date() } : null);
      
      if (status === 'connected') {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } else {
      toast.error('Failed to test connection');
    }
    
    setIsTesting(false);
  }

  async function handleLoadTables() {
    setIsLoadingTables(true);
    const response = await getDataSourceTables(id);
    
    if (response.success && response.data) {
      setTables(response.data);
      toast.success(`Found ${response.data.length} tables`);
    } else {
      toast.error('Failed to discover tables');
    }
    
    setIsLoadingTables(false);
  }

  if (isLoading) {
    return (
      <>
        <Header title="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </>
    );
  }

  const StatusIcon = dataSource?.connectionStatus === 'connected' 
    ? CheckCircle2 
    : dataSource?.connectionStatus === 'failed' 
    ? XCircle 
    : AlertCircle;

  const statusColor = dataSource?.connectionStatus === 'connected'
    ? 'text-emerald-400'
    : dataSource?.connectionStatus === 'failed'
    ? 'text-red-400'
    : 'text-amber-400';

  return (
    <>
      <Header
        title={dataSource?.name || 'Edit Data Source'}
        description="Manage database connection settings"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/data-sources">
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
            <TabsTrigger value="tables">Discover Tables</TabsTrigger>
            <TabsTrigger value="configs">Sync Configs</TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Status Card */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-6 w-6 ${statusColor}`} />
                    <div>
                      <p className="font-medium capitalize">{dataSource?.connectionStatus}</p>
                      {dataSource?.lastTestedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last tested {formatDistanceToNow(new Date(dataSource.lastTestedAt), { addSuffix: true })}
                        </p>
                      )}
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

              {/* Connection Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Connection Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Database Type</Label>
                    <Select value={formData.dbType} onValueChange={(v) => updateField('dbType', v as DatabaseType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dbTypes.map((db) => (
                          <SelectItem key={db.value} value={db.value}>
                            <span className="flex items-center gap-2">
                              <span>{db.icon}</span>
                              <span>{db.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        value={formData.host}
                        onChange={(e) => updateField('host', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => updateField('port', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      value={formData.database}
                      onChange={(e) => updateField('database', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Authentication */}
              <Card>
                <CardHeader>
                  <CardTitle>Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => updateField('username', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label htmlFor="ssl" className="text-sm font-medium">SSL/TLS Encryption</Label>
                      <p className="text-xs text-muted-foreground">Enable secure connection</p>
                    </div>
                    <Switch
                      id="ssl"
                      checked={formData.sslEnabled}
                      onCheckedChange={(checked) => updateField('sslEnabled', checked)}
                    />
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Database Tables</CardTitle>
                    <CardDescription>Discover available tables and columns from the source database</CardDescription>
                  </div>
                  <Button onClick={handleLoadTables} disabled={isLoadingTables}>
                    {isLoadingTables ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Discover Tables
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tables.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Click &quot;Discover Tables&quot; to load available tables
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tables.map((table) => (
                      <div key={`${table.schema}.${table.table}`} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{table.schema}</Badge>
                          <span className="font-medium">{table.table}</span>
                          <Badge variant="secondary">{table.columns.length} columns</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {table.columns.map((col) => (
                            <Badge key={col.name} variant="outline" className="text-xs">
                              {col.name}: <span className="text-muted-foreground">{col.type}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sync Configurations</CardTitle>
                    <CardDescription>Configurations using this data source</CardDescription>
                  </div>
                  <Button asChild>
                    <Link href={`/sync-configs/new?dataSourceId=${id}`}>Create Sync Config</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!dataSource?.syncConfigs || dataSource.syncConfigs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No sync configurations yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dataSource.syncConfigs.map((config) => (
                      <Link
                        key={config.id}
                        href={`/sync-configs/${config.id}`}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                      >
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {config.scheduleType} • {config.syncMode}
                          </p>
                        </div>
                        <Badge variant={config.isActive ? 'default' : 'secondary'}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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

