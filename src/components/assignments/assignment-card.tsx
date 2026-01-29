'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitBranch,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileJson,
  Zap,
  Database,
  Globe,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Assignment } from '@/types';

interface AssignmentCardProps {
  assignment: Assignment & { 
    _count?: { extractionRules: number; extractionJobs: number };
    dataSource?: { id: string; name: string; dbType: string; connectionStatus: string };
    webSource?: { id: string; name: string; baseUrl: string; connectionStatus: string };
  };
  onDelete?: () => void;
  onRun?: () => void;
  onPause?: () => void;
  onActivate?: () => void;
  isRunning?: boolean;
  compact?: boolean;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  draft: { icon: FileJson, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Draft' },
  testing: { icon: Clock, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Testing' },
  active: { icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Active' },
  paused: { icon: Pause, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Paused' },
  error: { icon: AlertTriangle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Error' },
};

const syncModeConfig: Record<string, { className: string; label: string }> = {
  manual: { className: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Manual' },
  auto: { className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', label: 'Auto' },
};

export function AssignmentCard({
  assignment,
  onDelete,
  onRun,
  onPause,
  onActivate,
  isRunning,
  compact = false,
}: AssignmentCardProps) {
  const status = statusConfig[assignment.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const syncMode = syncModeConfig[assignment.syncMode] || syncModeConfig.manual;

  if (compact) {
    return (
      <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
        <Link href={`/assignments/${assignment.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium truncate">{assignment.name}</h4>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {assignment.targetTable}
                </p>
              </div>
              <Badge className={`shrink-0 gap-1 ${status.className}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {assignment.webSource?.name || 'Unknown'}
              </span>
              <span>→</span>
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                {assignment.dataSource?.name || 'Unknown'}
              </span>
            </div>
          </CardContent>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/10">
            <GitBranch className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <CardTitle className="text-lg">{assignment.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>{assignment.targetTable}</span>
            </CardDescription>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/assignments/${assignment.id}`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            {assignment.status === 'active' && onPause && (
              <DropdownMenuItem onClick={onPause}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
            )}
            {(assignment.status === 'paused' || assignment.status === 'testing') && onActivate && (
              <DropdownMenuItem onClick={onActivate}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            {onRun && (
              <DropdownMenuItem onClick={onRun} disabled={isRunning}>
                {isRunning ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Now
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`gap-1 ${status.className}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
          
          <Badge variant="outline" className={syncMode.className}>
            {syncMode.label}
          </Badge>
          
          {assignment._count?.extractionRules ? (
            <Badge variant="secondary">
              {assignment._count.extractionRules} rule{assignment._count.extractionRules !== 1 ? 's' : ''}
            </Badge>
          ) : null}

          {assignment.scheduleType !== 'manual' && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              <Clock className="mr-1 h-3 w-3" />
              {assignment.scheduleType}
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-md bg-muted p-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium truncate">{assignment.webSource?.name}</p>
              <p className="text-muted-foreground truncate">{assignment.webSource?.baseUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted p-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium truncate">{assignment.dataSource?.name}</p>
              <p className="text-muted-foreground">{assignment.dataSource?.dbType}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {assignment._count?.extractionJobs || 0} job{(assignment._count?.extractionJobs || 0) !== 1 ? 's' : ''} run
          </span>
          <span>
            Created {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssignmentCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-muted rounded animate-pulse" />
          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
