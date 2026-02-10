'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Database,
  LayoutDashboard,
  RefreshCw,
  Settings,
  History,
  Shield,
  FileOutput,
  ChevronDown,
  LogOut,
  User,
  Users,
  UserCog,
  Globe,
  GitBranch,
  Play,
  FileText,
  Zap,
  Type,
} from 'lucide-react';
import { useFontSize, type FontSize } from '@/hooks/use-font-size';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Badge } from '@/components/ui/badge';

// SyncEngine - Main navigation items visible to all authenticated users
const mainNavigationItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Databases',
    href: '/data-sources',
    icon: Database,
  },
  {
    title: 'Web Sources',
    href: '/web-sources',
    icon: Globe,
  },
  {
    title: 'Assignments',
    href: '/assignments',
    icon: GitBranch,
  },
  {
    title: 'Extraction Jobs',
    href: '/extraction-jobs',
    icon: Play,
  },
  {
    title: 'Logs',
    href: '/logs',
    icon: FileText,
  },
  {
    title: 'Audit Trail',
    href: '/audit-logs',
    icon: History,
  },
];

// Legacy navigation items (hidden by default, kept for compatibility)
const legacyNavigationItems = [
  {
    title: 'Sync Configs',
    href: '/sync-configs',
    icon: RefreshCw,
  },
  {
    title: 'Sync Jobs',
    href: '/jobs',
    icon: FileOutput,
  },
];

// Admin-only navigation items
const adminNavigationItems = [
  {
    title: 'User Management',
    href: '/users',
    icon: Users,
  },
];

// Settings item (visible to all, but with different access levels)
const settingsItem = {
  title: 'Settings',
  href: '/settings',
  icon: Settings,
};

const fontSizeOptions: { value: FontSize; label: string }[] = [
  { value: 'compact', label: 'A' },
  { value: 'default', label: 'A' },
  { value: 'large', label: 'A' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { fontSize, setFontSize } = useFontSize();

  const userInitial = session?.user?.name?.[0] || session?.user?.email?.[0] || 'U';
  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';
  const userRole = session?.user?.role || 'supervisor';
  const isAdmin = userRole === 'admin';

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              Sync
            </span>
            <span className="text-xs font-medium text-sidebar-foreground/60">
              Engine
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigationItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className="h-10 px-3 transition-colors"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin-only section */}
        {isAdmin && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigationItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                      className="h-10 px-3 transition-colors"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === settingsItem.href}
                  className="h-10 px-3 transition-colors"
                >
                  <Link href={settingsItem.href}>
                    <settingsItem.icon className="h-4 w-4" />
                    <span>{settingsItem.title}</span>
                    {!isAdmin && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Limited
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        {/* Font Size Toggle */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5 text-sidebar-foreground/60">
            <Type className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Text Size</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-sidebar-border bg-sidebar p-0.5">
            {fontSizeOptions.map((opt, i) => (
              <button
                key={opt.value}
                onClick={() => setFontSize(opt.value)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  fontSize === opt.value
                    ? 'bg-sidebar-accent text-sidebar-foreground font-semibold'
                    : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'
                }`}
                title={opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                style={{ fontSize: i === 0 ? '11px' : i === 1 ? '13px' : '15px' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white uppercase">
                {userInitial}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {userName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {userEmail}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium">{userEmail}</p>
              <div className="mt-1 flex items-center gap-2">
                {isAdmin ? (
                  <Badge variant="secondary" className="bg-violet-500/10 text-violet-500">
                    <Shield className="mr-1 h-3 w-3" />
                    Admin
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                    <UserCog className="mr-1 h-3 w-3" />
                    Supervisor
                  </Badge>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
