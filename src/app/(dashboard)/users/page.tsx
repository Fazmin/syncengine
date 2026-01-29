'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Users,
  UserPlus,
  Search,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  UserCog,
  Eye,
  Ban,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import type { User } from '@/types';

interface UsersResponse {
  success: boolean;
  data: User[];
  stats: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  approved: { icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  suspended: { icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  expired: { icon: XCircle, color: 'text-slate-500', bgColor: 'bg-slate-500/10' },
};

const roleConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  admin: { icon: Shield, label: 'Admin', color: 'text-violet-500' },
  supervisor: { icon: UserCog, label: 'Supervisor', color: 'text-blue-500' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UsersResponse['stats'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, roleFilter]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);

      const response = await fetch(`/api/users?${params}`);
      const data: UsersResponse = await response.json();
      
      if (data.success) {
        setUsers(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('User approved successfully');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to approve user');
      }
    } catch {
      toast.error('Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSuspend(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('User suspended');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to suspend user');
      }
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('User deleted');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(null);
      setDeleteDialog({ open: false, user: null });
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.name?.toLowerCase().includes(query))
    );
  });

  return (
    <>
      <Header
        title="User Management"
        description="Manage user accounts and permissions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUsers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/users/new">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Link>
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Users
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.byStatus?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Suspended
              </CardTitle>
              <Ban className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.byStatus?.suspended || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">No users found</p>
                <Button asChild className="mt-4">
                  <Link href="/users/new">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add First User
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const status = statusConfig[user.status] || statusConfig.pending;
                    const role = roleConfig[user.role] || roleConfig.supervisor;
                    const StatusIcon = status.icon;
                    const RoleIcon = role.icon;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white uppercase">
                              {user.name?.[0] || user.email[0]}
                            </div>
                            <div>
                              <p className="font-medium">{user.name || 'Unnamed'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RoleIcon className={`h-4 w-4 ${role.color}`} />
                            <span className="text-sm">{role.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${status.bgColor} ${status.color} border-0`}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.lastLoginAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.expiresAt ? (
                            <span className={`text-sm ${new Date(user.expiresAt) < new Date() ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {format(new Date(user.expiresAt), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={actionLoading === user.id}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/users/${user.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                                  <UserCheck className="mr-2 h-4 w-4 text-emerald-500" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {user.status === 'approved' && (
                                <DropdownMenuItem onClick={() => handleSuspend(user.id)}>
                                  <Ban className="mr-2 h-4 w-4 text-amber-500" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              {user.status === 'suspended' && (
                                <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                                  <UserCheck className="mr-2 h-4 w-4 text-emerald-500" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteDialog({ open: true, user })}
                                className="text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.user?.email}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.user && handleDelete(deleteDialog.user.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

