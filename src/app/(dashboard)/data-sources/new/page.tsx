'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Zap, FileIcon, FolderOpen } from 'lucide-react';
import { createDataSource } from '@/lib/api';
import type { DatabaseType } from '@/types';
import { toast } from 'sonner';

const dbTypes: { value: DatabaseType; label: string; icon: string; defaultPort: number; isFileDb?: boolean }[] = [
  { value: 'sqlite', label: 'SQLite', icon: '📦', defaultPort: 0, isFileDb: true },
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', icon: '🐬', defaultPort: 3306 },
  { value: 'mssql', label: 'SQL Server', icon: '🪟', defaultPort: 1433 },
  { value: 'oracle', label: 'Oracle', icon: '🔶', defaultPort: 1521 },
];

// Available SQLite databases for selection
const availableSqliteDbs = [
  { path: './data/products.db', name: 'Products Database', description: 'E-commerce product catalog' },
  { path: './data/customers.db', name: 'Customers Database', description: 'Customer information and orders' },
];

export default function NewDataSourcePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dbType: 'sqlite' as DatabaseType,
    host: 'localhost',
    port: 0,
    database: '',
    username: 'admin',
    password: 'admin',
    sslEnabled: false,
  });

  const isFileDatabase = dbTypes.find(db => db.value === formData.dbType)?.isFileDb || false;

  function updateField<K extends keyof typeof formData>(key: K, value: typeof formData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleDbTypeChange(value: DatabaseType) {
    const dbConfig = dbTypes.find((db) => db.value === value);
    const isFileBased = dbConfig?.isFileDb || false;
    
    setFormData((prev) => ({
      ...prev,
      dbType: value,
      port: dbConfig?.defaultPort || prev.port,
      host: isFileBased ? 'localhost' : prev.host,
      username: isFileBased ? 'admin' : prev.username,
      password: isFileBased ? 'admin' : prev.password,
      sslEnabled: isFileBased ? false : prev.sslEnabled,
      database: '',
    }));
  }

  function handleSqliteDbSelect(path: string) {
    const selectedDb = availableSqliteDbs.find(db => db.path === path);
    if (selectedDb) {
      setFormData(prev => ({
        ...prev,
        database: path,
        name: prev.name || selectedDb.name,
        description: prev.description || selectedDb.description,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (isFileDatabase) {
      if (!formData.name || !formData.database) {
        toast.error('Please fill in all required fields');
        return;
      }
    } else {
      if (!formData.name || !formData.host || !formData.database || !formData.username || !formData.password) {
        toast.error('Please fill in all required fields');
        return;
      }
    }

    setIsSubmitting(true);

    const response = await createDataSource(formData);

    if (response.success) {
      toast.success('Data source created successfully');
      router.push('/data-sources');
    } else {
      toast.error(response.error || 'Failed to create data source');
    }

    setIsSubmitting(false);
  }

  return (
    <>
      <Header
        title="New Data Source"
        description="Configure a new database connection"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/data-sources">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Give your data source a name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Production Database"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Main production PostgreSQL database"
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
              <CardDescription>Configure how to connect to the database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Database Type *</Label>
                <Select value={formData.dbType} onValueChange={handleDbTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dbTypes.map((db) => (
                      <SelectItem key={db.value} value={db.value}>
                        <span className="flex items-center gap-2">
                          <span>{db.icon}</span>
                          <span>{db.label}</span>
                          {db.isFileDb && <span className="text-xs text-muted-foreground">(File)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isFileDatabase ? (
                /* SQLite File Selection */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Database File *</Label>
                    <Select 
                      value={formData.database} 
                      onValueChange={handleSqliteDbSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a database file..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSqliteDbs.map((db) => (
                          <SelectItem key={db.path} value={db.path}>
                            <span className="flex items-center gap-2">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{db.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select from available SQLite database files
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database">Or enter custom path</Label>
                    <Input
                      id="database"
                      placeholder="./data/custom.db"
                      value={formData.database}
                      onChange={(e) => updateField('database', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Path relative to the application root or absolute path
                    </p>
                  </div>

                  {formData.database && (
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium">Selected file:</p>
                          <p className="text-xs text-muted-foreground font-mono">{formData.database}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Database Connection */
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host *</Label>
                      <Input
                        id="host"
                        placeholder="localhost"
                        value={formData.host}
                        onChange={(e) => updateField('host', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port *</Label>
                      <Input
                        id="port"
                        type="number"
                        placeholder="5432"
                        value={formData.port}
                        onChange={(e) => updateField('port', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database">Database Name *</Label>
                    <Input
                      id="database"
                      placeholder="mydb"
                      value={formData.database}
                      onChange={(e) => updateField('database', e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Authentication - Only show for non-file databases */}
          {!isFileDatabase && (
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>Database credentials (stored securely)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    placeholder="db_user"
                    value={formData.username}
                    onChange={(e) => updateField('username', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="ssl" className="text-sm font-medium">SSL/TLS Encryption</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable secure connection (recommended)
                    </p>
                  </div>
                  <Switch
                    id="ssl"
                    checked={formData.sslEnabled}
                    onCheckedChange={(checked) => updateField('sslEnabled', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href="/data-sources">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Create Data Source
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}

