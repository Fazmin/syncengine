'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
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
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw } from 'lucide-react';
import { getProcessLogs } from '@/lib/api';
import type { ProcessLog } from '@/types';
import { format } from 'date-fns';

export default function LogsPage() {
  const [logs, setLogs] = useState<(ProcessLog & { job?: { id: string; status: string; assignment?: { id: string; name: string } } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [levelFilter]);

  async function fetchLogs() {
    setIsLoading(true);
    const response = await getProcessLogs({
      level: levelFilter === 'all' ? undefined : levelFilter,
      limit: 200,
    });
    if (response.success && response.data) {
      setLogs(response.data.logs);
    }
    setIsLoading(false);
  }

  return (
    <>
      <Header
        title="Process Logs"
        description="View logs from all extraction jobs"
        actions={
          <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Logs</CardTitle>
                <CardDescription>{logs.length} log entries</CardDescription>
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No logs yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Logs will appear here when extraction jobs run
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-md border p-3 text-sm ${
                        log.level === 'error' ? 'border-red-500/30 bg-red-500/5' :
                        log.level === 'warn' ? 'border-amber-500/30 bg-amber-500/5' :
                        log.level === 'info' ? 'border-blue-500/30 bg-blue-500/5' :
                        'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            log.level === 'info' ? 'text-blue-400' :
                            'text-muted-foreground'
                          }>
                            {log.level}
                          </Badge>
                          {log.job?.assignment && (
                            <span className="text-xs text-muted-foreground">
                              {log.job.assignment.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                        </span>
                      </div>
                      <p>{log.message}</p>
                      {log.url && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          URL: {log.url}
                        </p>
                      )}
                    </div>
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
