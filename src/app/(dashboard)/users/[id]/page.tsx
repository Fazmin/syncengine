'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Loader2,
  Save,
  CalendarIcon,
  Shield,
  UserCog,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Trash2,
  Mail,
  User,
  Activity,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { User as UserType, AuditLog } from '@/types';

interface UserDetails extends UserType {
  approver?: { id: string; name: string | null; email: string } | null;
  recentActivity?: AuditLog[];
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Pending Approval' },
  approved: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Approved' },
  suspended: { icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Suspended' },
  expired: { icon: XCircle, color: 'text-slate-500', bgColor: 'bg-slate-500/10', label: 'Expired' },
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'supervisor',
    status: 'pending',
    expiresAt: null as Date | null,
  });

  useEffect(() => {
    fetchUser();
  }, [id]);

  async function fetchUser() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setUser(data.data);
        setFormData({
          name: data.data.name || '',
          role: data.data.role,
          status: data.data.status,
          expiresAt: data.data.expiresAt ? new Date(data.data.expiresAt) : null,
        });
      } else {
        toast.error('User not found');
        router.push('/users');
      }
    } catch {
      toast.error('Failed to fetch user');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt?.toISOString() || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('User updated successfully');
        fetchUser();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch {
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('User deleted');
        router.push('/users');
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <Header title="User Details" description="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return null;
  }

  const status = statusConfig[user.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <>
      <Header
        title="User Details"
        description={user.email}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/users">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Users
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this user? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* User Overview Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-2xl font-bold text-white uppercase">
                  {user.name?.[0] || user.email[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">{user.name || 'Unnamed User'}</h2>
                    <Badge variant="secondary" className={`${status.bgColor} ${status.color} border-0`}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{user.email}</p>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      {user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-violet-500" />
                      ) : (
                        <UserCog className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="capitalize">{user.role}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {user.loginCount} login{user.loginCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Last login: {user.lastLoginAt 
                          ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                          : 'Never'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Edit Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Edit User
                </CardTitle>
                <CardDescription>
                  Update user details and permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isSaving}
                  />
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-blue-500" />
                          Supervisor
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-violet-500" />
                          Admin
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          Pending
                        </div>
                      </SelectItem>
                      <SelectItem value="approved">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Approved
                        </div>
                      </SelectItem>
                      <SelectItem value="suspended">
                        <div className="flex items-center gap-2">
                          <Ban className="h-4 w-4 text-red-500" />
                          Suspended
                        </div>
                      </SelectItem>
                      <SelectItem value="expired">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-slate-500" />
                          Expired
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Expiry Date */}
                <div className="space-y-2">
                  <Label>Account Expiry</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.expiresAt && 'text-muted-foreground'
                        )}
                        disabled={isSaving}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expiresAt 
                          ? format(formData.expiresAt, 'PPP')
                          : 'Never expires'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.expiresAt || undefined}
                        onSelect={(date) => setFormData({ ...formData, expiresAt: date || null })}
                        initialFocus
                      />
                      {formData.expiresAt && (
                        <div className="border-t p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setFormData({ ...formData, expiresAt: null })}
                          >
                            Clear expiry date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator />

                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
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
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(user.createdAt), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium">
                      {format(new Date(user.updatedAt), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved</p>
                    <p className="font-medium">
                      {user.approvedAt 
                        ? format(new Date(user.approvedAt), 'PPP')
                        : 'Not approved'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved By</p>
                    <p className="font-medium">
                      {user.approver?.name || user.approver?.email || 'N/A'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 font-medium">Recent Activity</h4>
                  {user.recentActivity && user.recentActivity.length > 0 ? (
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {user.recentActivity.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-center gap-3 text-sm">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="flex-1 text-muted-foreground">
                              {log.eventType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

