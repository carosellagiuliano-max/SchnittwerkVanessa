'use client';

import Link from 'next/link';
import {
  Calendar,
  Users,
  ShoppingBag,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  pendingOrders: number;
  monthlyRevenue: number;
  newCustomers: number;
  cancelledAppointments: number;
}

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  duration: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  totalCents: number;
  status: string;
  createdAt: string;
}

interface AdminDashboardContentProps {
  stats: DashboardStats;
  todayAppointments: TodayAppointment[];
  recentOrders: RecentOrder[];
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig = {
  confirmed: {
    label: 'Bestätigt',
    variant: 'default' as const,
    icon: CheckCircle,
  },
  pending: {
    label: 'Ausstehend',
    variant: 'secondary' as const,
    icon: Clock,
  },
  cancelled: {
    label: 'Storniert',
    variant: 'destructive' as const,
    icon: XCircle,
  },
  completed: {
    label: 'Abgeschlossen',
    variant: 'outline' as const,
    icon: CheckCircle,
  },
};

const orderStatusLabels: Record<string, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  processing: 'In Bearbeitung',
  shipped: 'Versendet',
  delivered: 'Geliefert',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  refunded: 'Erstattet',
};

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  href,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; isPositive: boolean };
  href?: string;
}) {
  const content = (
    <Card className={cn(href && 'transition-shadow hover:shadow-md')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div
            className={cn(
              'flex items-center text-xs mt-1',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            <TrendingUp
              className={cn('h-3 w-3 mr-1', !trend.isPositive && 'rotate-180')}
            />
            {trend.value}% vs. letzter Monat
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================
// ADMIN DASHBOARD CONTENT
// ============================================

export function AdminDashboardContent({
  stats,
  todayAppointments,
  recentOrders,
}: AdminDashboardContentProps) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Termine heute"
          value={stats.todayAppointments}
          description={`${stats.cancelledAppointments} storniert`}
          icon={Calendar}
          href="/admin/kalender"
        />
        <StatCard
          title="Termine diese Woche"
          value={stats.weekAppointments}
          icon={Clock}
          href="/admin/kalender"
        />
        {features.shopEnabled && (
          <StatCard
            title="Offene Bestellungen"
            value={stats.pendingOrders}
            icon={ShoppingBag}
            href="/admin/bestellungen"
          />
        )}
        <StatCard
          title="Umsatz diesen Monat"
          value={formatCurrency(stats.monthlyRevenue)}
          description={`${stats.newCustomers} neue Kunden`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Termine heute</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/kalender">
                Alle anzeigen
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Keine Termine für heute
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.slice(0, 6).map((appointment) => {
                  const status = statusConfig[appointment.status];
                  const StatusIcon = status.icon;
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium w-14">
                          {appointment.time}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {appointment.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {appointment.serviceName} - {appointment.staffName}
                          </p>
                        </div>
                      </div>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
                {todayAppointments.length > 6 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    + {todayAppointments.length - 6} weitere Termine
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        {features.shopEnabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Letzte Bestellungen</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/bestellungen">
                  Alle anzeigen
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Keine Bestellungen vorhanden
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/bestellungen/${order.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">#{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customerEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatCurrency(order.totalCents)}
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          {orderStatusLabels[order.status] || order.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/admin/kalender?action=new">
                <Calendar className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="font-medium">Termin erstellen</p>
                  <p className="text-xs text-muted-foreground">
                    Neuen Termin anlegen
                  </p>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/admin/kunden?action=new">
                <Users className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="font-medium">Kunde anlegen</p>
                  <p className="text-xs text-muted-foreground">
                    Neuen Kunden erfassen
                  </p>
                </div>
              </Link>
            </Button>
            {features.shopEnabled && (
              <>
                <Button variant="outline" className="justify-start h-auto py-3" asChild>
                  <Link href="/admin/produkte?action=new">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <p className="font-medium">Produkt hinzufügen</p>
                      <p className="text-xs text-muted-foreground">
                        Neues Produkt erstellen
                      </p>
                    </div>
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start h-auto py-3" asChild>
                  <Link href="/admin/bestellungen">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <p className="font-medium">Bestellungen prüfen</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.pendingOrders} offen
                      </p>
                    </div>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
