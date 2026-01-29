'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { ArrowLeft, Loader2, Save, UserPlus, CalendarIcon, Shield, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function NewUserPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'supervisor',
    expiresAt: null as Date | null,
    autoApprove: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt?.toISOString() || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('User created successfully');
        router.push('/users');
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch {
      toast.error('Failed to create user');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Header
        title="Add New User"
        description="Create a new user account"
        actions={
          <Button variant="outline" asChild>
            <Link href="/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  User Details
                </CardTitle>
                <CardDescription>
                  Enter the details for the new user account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    User will receive OTP codes at this email address
                  </p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                  />
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={isLoading}
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
                  <p className="text-xs text-muted-foreground">
                    {formData.role === 'admin' 
                      ? 'Admins have full access to all features including user management'
                      : 'Supervisors can access most features except user management and system settings'
                    }
                  </p>
                </div>

                {/* Account Expiry */}
                <div className="space-y-2">
                  <Label>Account Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.expiresAt && 'text-muted-foreground'
                        )}
                        disabled={isLoading}
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
                        disabled={(date) => date < new Date()}
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
                  <p className="text-xs text-muted-foreground">
                    Set an expiry date to automatically deactivate the account
                  </p>
                </div>

                {/* Auto Approve */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Auto-approve account</Label>
                    <p className="text-sm text-muted-foreground">
                      Immediately approve this account so the user can log in
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoApprove}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoApprove: checked })}
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="mt-6 flex justify-end gap-4">
              <Button type="button" variant="outline" asChild disabled={isLoading}>
                <Link href="/users">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

