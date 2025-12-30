'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  ShoppingBag,
  Package,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Scissors,
  LogOut,
  HelpCircle,
  Warehouse,
  BarChart3,
  Bell,
  Receipt,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface AdminSidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  /** Feature flag key - if set, item only shows when feature is enabled */
  feature?: keyof typeof features;
}

// ============================================
// NAVIGATION DATA
// ============================================

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Kalender',
    href: '/admin/kalender',
    icon: Calendar,
  },
  {
    label: 'Kunden',
    href: '/admin/kunden',
    icon: Users,
  },
  {
    label: 'Bestellungen',
    href: '/admin/bestellungen',
    icon: ShoppingBag,
    feature: 'shopEnabled',
  },
  {
    label: 'Produkte',
    href: '/admin/produkte',
    icon: Package,
    feature: 'shopEnabled',
  },
  {
    label: 'Inventar',
    href: '/admin/inventar',
    icon: Warehouse,
    roles: ['admin', 'manager', 'hq'],
    feature: 'shopEnabled',
  },
  {
    label: 'Team',
    href: '/admin/team',
    icon: UserCog,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    roles: ['admin', 'manager', 'hq'],
  },
  {
    label: 'Finanzen',
    href: '/admin/finanzen',
    icon: Receipt,
    roles: ['admin', 'hq'],
  },
  {
    label: 'Benachrichtigungen',
    href: '/admin/benachrichtigungen',
    icon: Bell,
    roles: ['admin', 'hq'],
  },
  {
    label: 'Datenexport',
    href: '/admin/export',
    icon: Download,
    roles: ['admin', 'hq'],
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: 'Einstellungen',
    href: '/admin/einstellungen',
    icon: Settings,
    roles: ['admin', 'hq'],
  },
  {
    label: 'Hilfe',
    href: '/admin/hilfe',
    icon: HelpCircle,
  },
];

// ============================================
// ROLE LABELS
// ============================================

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Mitarbeiter',
  hq: 'Hauptverwaltung',
};

// ============================================
// ADMIN SIDEBAR COMPONENT
// ============================================

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isAllowed = (item: NavItem) => {
    // Check feature flag first
    if (item.feature && !features[item.feature]) return false;
    // Then check role
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-full border-r bg-card transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">SCHNITTWERK</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/admin" className="mx-auto">
              <Scissors className="h-6 w-6 text-primary" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
            aria-label={isCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {mainNavItems.filter(isAllowed).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 mx-auto rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t p-2 space-y-1">
          {bottomNavItems.filter(isAllowed).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 mx-auto rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User Info & Logout */}
        <div className="border-t p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[user.role] || user.role}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <form action="/api/auth/signout" method="POST">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </form>
                </TooltipTrigger>
                <TooltipContent side="right">Abmelden</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <form action="/api/auth/signout" method="POST">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 mx-auto flex text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </form>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Abmelden ({user.name})
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
