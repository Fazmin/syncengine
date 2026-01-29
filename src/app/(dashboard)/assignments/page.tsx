'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  GitBranch,
  Plus,
} from 'lucide-react';
import { getAssignments, deleteAssignment, updateAssignment, triggerExtraction } from '@/lib/api';
import { AssignmentCard, AssignmentCardSkeleton } from '@/components/assignments/assignment-card';
import type { Assignment } from '@/types';
import { toast } from 'sonner';

type AssignmentWithRelations = Assignment & {
  _count?: { extractionRules: number; extractionJobs: number };
  dataSource?: { id: string; name: string; dbType: string; connectionStatus: string };
  webSource?: { id: string; name: string; baseUrl: string; connectionStatus: string };
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    const response = await getAssignments();
    if (response.success && response.data) {
      setAssignments(response.data);
    }
    setIsLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    
    const response = await deleteAssignment(deleteId);
    if (response.success) {
      setAssignments((prev) => prev.filter((a) => a.id !== deleteId));
      toast.success('Assignment deleted');
    } else {
      toast.error(response.error || 'Failed to delete assignment');
    }
    setDeleteId(null);
  }

  async function handleRun(id: string) {
    setRunningIds(prev => new Set(prev).add(id));
    
    const response = await triggerExtraction(id);
    
    if (response.success && response.data) {
      toast.success(`Extraction started (Job: ${response.data.jobId.slice(0, 8)}...)`);
      // Update assignment status if it was draft
      setAssignments(prev => 
        prev.map(a => a.id === id && a.status === 'draft' 
          ? { ...a, status: 'testing' } 
          : a
        )
      );
    } else {
      toast.error(response.error || 'Failed to start extraction');
    }
    
    setRunningIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleStatusChange(id: string, status: string) {
    const response = await updateAssignment(id, { status });
    
    if (response.success) {
      setAssignments(prev => 
        prev.map(a => a.id === id ? { ...a, status } : a)
      );
      toast.success(`Assignment ${status === 'active' ? 'activated' : 'paused'}`);
    } else {
      toast.error(response.error || 'Failed to update assignment');
    }
  }

  return (
    <>
      <Header
        title="Assignments"
        description="Manage database-website extraction pairs"
        actions={
          <Button asChild>
            <Link href="/assignments/new">
              <Plus className="mr-2 h-4 w-4" />
              New Assignment
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <p className="text-sm text-muted-foreground">
              {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
            </p>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <AssignmentCardSkeleton key={i} />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/10">
                  <GitBranch className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No assignments yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first assignment to link a website to a database
                </p>
                <Button asChild className="mt-6">
                  <Link href="/assignments/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Assignment
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onDelete={() => setDeleteId(assignment.id)}
                  onRun={() => handleRun(assignment.id)}
                  onPause={assignment.status === 'active' 
                    ? () => handleStatusChange(assignment.id, 'paused') 
                    : undefined}
                  onActivate={(assignment.status === 'paused' || assignment.status === 'testing')
                    ? () => handleStatusChange(assignment.id, 'active')
                    : undefined}
                  isRunning={runningIds.has(assignment.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this assignment, its extraction rules, and all job history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
