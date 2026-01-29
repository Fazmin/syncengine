'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Server,
  Clock,
  Save,
  Mail,
  Loader2,
  CheckCircle2,
  XCircle,
  TestTube,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SmtpSettings } from '@/types';

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [activeTab, setActiveTab] = useState(isAdmin ? 'general' : 'notifications');
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings & { hasPassword?: boolean }>({
    id: '',
    enabled: false,
    service: 'custom',
    host: '',
    port: 25,
    secure: false,
    ignoreTls: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'SyncEngine',
    lastTestedAt: null,
    testStatus: null,
    testError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);

  // Load SMTP settings on mount (admin only)
  useEffect(() => {
    if (isAdmin) {
      fetchSmtpSettings();
    }
  }, [isAdmin]);

  async function fetchSmtpSettings() {
    try {
      const response = await fetch('/api/smtp');
      const data = await response.json();
      if (data.success) {
        setSmtpSettings(data.data);
      }
    } catch {
      // Settings may not exist yet
    }
  }

  async function handleSaveSmtp() {
    setSmtpLoading(true);
    try {
      const response = await fetch('/api/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpSettings),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('SMTP settings saved successfully');
        setSmtpSettings(data.data);
      } else {
        toast.error(data.error || 'Failed to save SMTP settings');
      }
    } catch {
      toast.error('Failed to save SMTP settings');
    } finally {
      setSmtpLoading(false);
    }
  }

  async function handleTestSmtp() {
    setSmtpTesting(true);
    try {
      const response = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...smtpSettings,
          useExisting: false,
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('SMTP connection successful');
        setSmtpSettings(prev => ({
          ...prev,
          lastTestedAt: new Date(),
          testStatus: 'success',
          testError: null,
        }));
      } else {
        toast.error(data.error || 'SMTP connection failed');
        setSmtpSettings(prev => ({
          ...prev,
          lastTestedAt: new Date(),
          testStatus: 'failed',
          testError: data.error,
        }));
      }
    } catch {
      toast.error('Failed to test SMTP connection');
    } finally {
      setSmtpTesting(false);
    }
  }

  function handleSave() {
    toast.success('Settings saved successfully');
  }

  return (
    <>
      <Header
        title="Settings"
        description="Configure application settings and preferences"
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              {isAdmin && <TabsTrigger value="general">General</TabsTrigger>}
              {isAdmin && <TabsTrigger value="security">Security</TabsTrigger>}
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              {isAdmin && <TabsTrigger value="storage">Storage</TabsTrigger>}
              {isAdmin && <TabsTrigger value="smtp">SMTP / Email</TabsTrigger>}
            </TabsList>

            {/* General Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      General Settings
                    </CardTitle>
                    <CardDescription>
                      Configure basic application settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="appName">Application Name</Label>
                      <Input id="appName" defaultValue="SyncEngine" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input id="timezone" defaultValue="UTC" />
                      <p className="text-xs text-muted-foreground">
                        All schedules and timestamps will use this timezone
                      </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Dark Mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable dark theme for the interface
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-refresh Dashboard</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically refresh dashboard data every 30 seconds
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Default Sync Settings
                    </CardTitle>
                    <CardDescription>
                      Default values for new sync configurations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="defaultPath">Default Output Path</Label>
                        <Input id="defaultPath" defaultValue="./output" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="defaultFile">Default File Name</Label>
                        <Input id="defaultFile" defaultValue="sync_data.db" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="rowLimit">Default Row Limit (per table)</Label>
                      <Input id="rowLimit" type="number" defaultValue="100000" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Security Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Security Settings
                    </CardTitle>
                    <CardDescription>
                      Configure security and encryption options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Encrypt Stored Credentials</Label>
                        <p className="text-xs text-muted-foreground">
                          Encrypt database passwords at rest
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require SSL for All Connections</Label>
                        <p className="text-xs text-muted-foreground">
                          Enforce SSL/TLS for all database connections
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                      <Input id="sessionTimeout" type="number" defaultValue="120" />
                      <p className="text-xs text-muted-foreground">
                        User sessions expire after this duration (default: 120 minutes)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otpExpiry">OTP Expiry (minutes)</Label>
                      <Input id="otpExpiry" type="number" defaultValue="10" />
                      <p className="text-xs text-muted-foreground">
                        Login verification codes expire after this duration
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Audit Log Retention</CardTitle>
                    <CardDescription>
                      How long to keep audit log entries
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="auditRetention">Retention Period (days)</Label>
                      <Input id="auditRetention" type="number" defaultValue="90" />
                      <p className="text-xs text-muted-foreground">
                        Logs older than this will be automatically deleted
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Notifications Tab - All Users */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Configure when and how to receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Send email alerts for important events
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sync Failure Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify when a sync job fails
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Connection Failure Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify when database connection fails
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sync Completion Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify when sync jobs complete successfully
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="notifyEmail">Notification Email</Label>
                    <Input 
                      id="notifyEmail" 
                      type="email" 
                      placeholder="your@email.com"
                      defaultValue={session?.user?.email || ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Notifications will be sent to this email address
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="storage" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Storage Settings
                    </CardTitle>
                    <CardDescription>
                      Configure output file storage and cleanup
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="storagePath">Base Storage Path</Label>
                      <Input id="storagePath" defaultValue="./output" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-cleanup Old Files</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically delete old sync output files
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fileRetention">File Retention (days)</Label>
                      <Input id="fileRetention" type="number" defaultValue="30" />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Compress Output by Default</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically compress sync output files
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Encrypt Output by Default</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically encrypt sync output files
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Cloud Storage (Optional)
                    </CardTitle>
                    <CardDescription>
                      Configure cloud storage for sync outputs
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Cloud Storage</Label>
                        <p className="text-xs text-muted-foreground">
                          Upload sync outputs to cloud storage
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cloudProvider">Cloud Provider</Label>
                      <Input id="cloudProvider" placeholder="Azure Blob / S3 / GCS" disabled />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bucketName">Bucket/Container Name</Label>
                      <Input id="bucketName" placeholder="syncengine-outputs" disabled />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* SMTP Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="smtp" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      SMTP Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure email server settings for OTP and notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label className="text-base">Enable Email Delivery</Label>
                        <p className="text-sm text-muted-foreground">
                          When disabled, OTP codes will be logged to console
                        </p>
                      </div>
                      <Switch
                        checked={smtpSettings.enabled}
                        onCheckedChange={(checked) => 
                          setSmtpSettings({ ...smtpSettings, enabled: checked })
                        }
                      />
                    </div>

                    {/* Test Status */}
                    {smtpSettings.lastTestedAt && (
                      <div className={`flex items-center gap-2 rounded-lg border p-4 ${
                        smtpSettings.testStatus === 'success' 
                          ? 'border-emerald-500/50 bg-emerald-500/10' 
                          : 'border-red-500/50 bg-red-500/10'
                      }`}>
                        {smtpSettings.testStatus === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {smtpSettings.testStatus === 'success' 
                              ? 'Connection Successful' 
                              : 'Connection Failed'
                            }
                          </p>
                          {smtpSettings.testError && (
                            <p className="text-sm text-muted-foreground">
                              {smtpSettings.testError}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Service Selection */}
                    <div className="space-y-2">
                      <Label>Email Service</Label>
                      <Select
                        value={smtpSettings.service}
                        onValueChange={(value) => 
                          setSmtpSettings({ ...smtpSettings, service: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom SMTP Server</SelectItem>
                          <SelectItem value="gmail">Gmail</SelectItem>
                          <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                          <SelectItem value="sendgrid">SendGrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* SMTP Host */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input
                          id="smtpHost"
                          placeholder="smtp365.mcmaster.ca"
                          value={smtpSettings.host || ''}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, host: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPort">SMTP Port</Label>
                        <Input
                          id="smtpPort"
                          type="number"
                          placeholder="25"
                          value={smtpSettings.port}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) || 25 })
                          }
                        />
                      </div>
                    </div>

                    {/* Security Options */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>Secure (TLS/SSL)</Label>
                          <p className="text-xs text-muted-foreground">
                            Use for port 465
                          </p>
                        </div>
                        <Switch
                          checked={smtpSettings.secure}
                          onCheckedChange={(checked) => 
                            setSmtpSettings({ ...smtpSettings, secure: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label>Ignore TLS</Label>
                          <p className="text-xs text-muted-foreground">
                            Skip TLS verification
                          </p>
                        </div>
                        <Switch
                          checked={smtpSettings.ignoreTls}
                          onCheckedChange={(checked) => 
                            setSmtpSettings({ ...smtpSettings, ignoreTls: checked })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Authentication */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="smtpUser">Username / Email</Label>
                        <Input
                          id="smtpUser"
                          placeholder="engai@mcmaster.ca"
                          value={smtpSettings.username || ''}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, username: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPassword">
                          Password
                          {smtpSettings.hasPassword && (
                            <Badge variant="secondary" className="ml-2">Saved</Badge>
                          )}
                        </Label>
                        <Input
                          id="smtpPassword"
                          type="password"
                          placeholder={smtpSettings.hasPassword ? '••••••••' : 'Optional'}
                          value={smtpSettings.password || ''}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, password: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Sender Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fromEmail">From Email</Label>
                        <Input
                          id="fromEmail"
                          type="email"
                          placeholder="engai@mcmaster.ca"
                          value={smtpSettings.fromEmail || ''}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fromName">From Name</Label>
                        <Input
                          id="fromName"
                          placeholder="SyncEngine"
                          value={smtpSettings.fromName}
                          onChange={(e) => 
                            setSmtpSettings({ ...smtpSettings, fromName: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleTestSmtp}
                        disabled={smtpTesting || !smtpSettings.host}
                      >
                        {smtpTesting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="mr-2 h-4 w-4" />
                            Test Connection
                          </>
                        )}
                      </Button>
                      <Button onClick={handleSaveSmtp} disabled={smtpLoading}>
                        {smtpLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save SMTP Settings
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* McMaster Example */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Example: McMaster University SMTP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Host:</span>
                        <code className="rounded bg-muted px-2 py-0.5">smtp365.mcmaster.ca</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Port:</span>
                        <code className="rounded bg-muted px-2 py-0.5">25</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ignore TLS:</span>
                        <code className="rounded bg-muted px-2 py-0.5">true</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">From Email:</span>
                        <code className="rounded bg-muted px-2 py-0.5">engai@mcmaster.ca</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {activeTab !== 'smtp' && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
