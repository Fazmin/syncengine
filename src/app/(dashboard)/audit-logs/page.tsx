'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  RefreshCw,
  Database,
  Settings,
  Play,
  CheckCircle2,
  XCircle,
  Download,
  User,
  Clock,
  Mail,
  KeyRound,
  UserPlus,
  UserMinus,
  UserCheck,
  Ban,
  Shield,
  LogIn,
  LogOut,
} from 'lucide-react';
import { getAuditLogs } from '@/lib/api';
import type { AuditLog } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  // Data Source Events
  data_source_created: { icon: Database, color: 'text-emerald-400', label: 'Data Source Created' },
  data_source_updated: { icon: Database, color: 'text-blue-400', label: 'Data Source Updated' },
  data_source_deleted: { icon: Database, color: 'text-red-400', label: 'Data Source Deleted' },
  connection_tested: { icon: Database, color: 'text-amber-400', label: 'Connection Tested' },
  
  // Sync Config Events
  sync_config_created: { icon: Settings, color: 'text-emerald-400', label: 'Sync Config Created' },
  sync_config_updated: { icon: Settings, color: 'text-blue-400', label: 'Sync Config Updated' },
  sync_config_deleted: { icon: Settings, color: 'text-red-400', label: 'Sync Config Deleted' },
  table_configs_updated: { icon: Settings, color: 'text-violet-400', label: 'Tables Configured' },
  
  // Sync Job Events
  sync_started: { icon: Play, color: 'text-blue-400', label: 'Sync Started' },
  sync_completed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Sync Completed' },
  sync_failed: { icon: XCircle, color: 'text-red-400', label: 'Sync Failed' },
  sync_cancelled: { icon: XCircle, color: 'text-amber-400', label: 'Sync Cancelled' },
  
  // File Events
  download: { icon: Download, color: 'text-violet-400', label: 'File Downloaded' },
  
  // Auth Events (Legacy)
  login: { icon: LogIn, color: 'text-blue-400', label: 'User Login' },
  
  // User Management Events
  user_created: { icon: UserPlus, color: 'text-emerald-400', label: 'User Created' },
  user_updated: { icon: User, color: 'text-blue-400', label: 'User Updated' },
  user_deleted: { icon: UserMinus, color: 'text-red-400', label: 'User Deleted' },
  user_approved: { icon: UserCheck, color: 'text-emerald-400', label: 'User Approved' },
  user_suspended: { icon: Ban, color: 'text-red-400', label: 'User Suspended' },
  
  // OTP Events
  otp_requested: { icon: Mail, color: 'text-blue-400', label: 'OTP Requested' },
  otp_request_failed: { icon: Mail, color: 'text-amber-400', label: 'OTP Request Failed' },
  otp_verified: { icon: KeyRound, color: 'text-emerald-400', label: 'OTP Verified' },
  otp_failed: { icon: KeyRound, color: 'text-red-400', label: 'OTP Failed' },
  otp_email_failed: { icon: Mail, color: 'text-red-400', label: 'OTP Email Failed' },
  
  // Session Events
  login_success: { icon: LogIn, color: 'text-emerald-400', label: 'Login Success' },
  login_failed: { icon: LogIn, color: 'text-red-400', label: 'Login Failed' },
  logout: { icon: LogOut, color: 'text-slate-400', label: 'Logged Out' },
  session_expired: { icon: Clock, color: 'text-amber-400', label: 'Session Expired' },
  
  // SMTP Events
  smtp_configured: { icon: Mail, color: 'text-blue-400', label: 'SMTP Configured' },
  smtp_tested: { icon: Mail, color: 'text-amber-400', label: 'SMTP Tested' },
  
  // Access Events
  access_denied: { icon: Shield, color: 'text-red-400', label: 'Access Denied' },
};

function AuditLogItem({ log }: { log: AuditLog }) {
  const config = eventTypeConfig[log.eventType] || { 
    icon: History, 
    color: 'text-muted-foreground', 
    label: log.eventType 
  };
  const Icon = config.icon;
  
  let details: Record<string, unknown> = {};
  try {
    if (log.eventDetails) {
      details = JSON.parse(log.eventDetails);
    }
  } catch {
    // Invalid JSON, ignore
  }

  return (
    <div className="flex gap-4 py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{config.label}</span>
          {log.resourceType && (
            <Badge variant="outline" className="text-xs">
              {log.resourceType}
            </Badge>
          )}
          {log.dataSource && (
            <Badge variant="secondary" className="text-xs">
              {log.dataSource.name}
            </Badge>
          )}
        </div>
        
        {Object.keys(details).length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {Object.entries(details).map(([key, value]) => (
              <span key={key} className="mr-3">
                <span className="text-muted-foreground/60">{key}:</span>{' '}
                <span className="font-mono text-xs">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </span>
            ))}
          </p>
        )}
        
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
          </span>
          <span className="text-muted-foreground/50">
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </span>
          {log.userEmail && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {log.userEmail}
            </span>
          )}
          {log.ipAddress && (
            <span className="font-mono">{log.ipAddress}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setIsLoading(true);
    const response = await getAuditLogs({ limit: 200 });
    if (response.success && response.data) {
      setLogs(response.data);
    }
    setIsLoading(false);
  }

  const filteredLogs = logs.filter((log) => {
    if (eventFilter !== 'all' && log.eventType !== eventFilter) return false;
    if (resourceFilter !== 'all' && log.resourceType !== resourceFilter) return false;
    return true;
  });

  const uniqueEventTypes = [...new Set(logs.map((l) => l.eventType))];
  const uniqueResourceTypes = [...new Set(logs.map((l) => l.resourceType).filter(Boolean))];

  return (
    <>
      <Header
        title="Audit Logs"
        description="Track all system activities and changes"
        actions={
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {uniqueEventTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {eventTypeConfig[type]?.label || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={resourceFilter} onValueChange={setResourceFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    {uniqueResourceTypes.map((type) => (
                      <SelectItem key={type} value={type!}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex gap-4 py-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-72" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <AuditLogItem key={log.id} log={log} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

