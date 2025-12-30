'use client';

import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Calendar,
  Users,
  DollarSign,
  Package,
  Scissors,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  appointments: number;
}

interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
}

interface TopService {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
}

interface AnalyticsStats {
  totalRevenue: number;
  totalOrders: number;
  totalAppointments: number;
  averageOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  cancelRate: number;
}

interface AdminAnalyticsViewProps {
  stats: AnalyticsStats;
  revenueData: RevenueData[];
  topProducts: TopProduct[];
  topServices: TopService[];
}

// ============================================
// HELPERS
// ============================================

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(dateString));
}

// Simple bar chart component
function SimpleBarChart({ data, maxValue }: { data: RevenueData[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-48">
      {data.map((item, index) => {
        const height = maxValue > 0 ? (item.revenue / maxValue) * 100 : 0;
        return (
          <div
            key={item.date}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${formatDate(item.date)}: ${formatPrice(item.revenue)}`}
          >
            <div
              className={cn(
                'w-full bg-primary rounded-t transition-all',
                height === 0 && 'bg-muted'
              )}
              style={{ height: `${Math.max(height, 2)}%` }}
            />
            {index % 5 === 0 && (
              <span className="text-xs text-muted-foreground">
                {formatDate(item.date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function AdminAnalyticsView({
  stats,
  revenueData,
  topProducts,
  topServices,
}: AdminAnalyticsViewProps) {
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  // Calculate week-over-week change (simplified)
  const thisWeekRevenue = revenueData.slice(-7).reduce((sum, d) => sum + d.revenue, 0);
  const lastWeekRevenue = revenueData.slice(-14, -7).reduce((sum, d) => sum + d.revenue, 0);
  const revenueChange = lastWeekRevenue > 0
    ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
    : 0;

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Datum', 'Umsatz (CHF)', 'Bestellungen', 'Termine'];
    const rows = revenueData.map((d) => [
      d.date,
      (d.revenue / 100).toFixed(2),
      d.orders.toString(),
      d.appointments.toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exportiert');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Übersicht der letzten 30 Tage
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          CSV Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className={cn(
        "grid gap-4",
        features.shopEnabled ? "md:grid-cols-4" : "md:grid-cols-3"
      )}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</div>
            <div className="flex items-center gap-1 text-xs">
              {revenueChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={cn(
                revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {revenueChange >= 0 ? '+' : ''}{revenueChange}%
              </span>
              <span className="text-muted-foreground">vs. letzte Woche</span>
            </div>
          </CardContent>
        </Card>

        {features.shopEnabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bestellungen</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Ø {formatPrice(stats.averageOrderValue)} pro Bestellung
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Termine</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAppointments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.cancelRate}% Stornierungsrate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neue Kunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newCustomers}</div>
            <p className="text-xs text-muted-foreground">
              diesen Monat
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Umsatzverlauf</CardTitle>
          <CardDescription>
            Täglicher Umsatz der letzten 30 Tage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={revenueData} maxValue={maxRevenue} />
        </CardContent>
      </Card>

      {/* Top Products and Services */}
      <Tabs defaultValue={features.shopEnabled ? "products" : "services"} className="space-y-4">
        <TabsList>
          {features.shopEnabled && (
            <TabsTrigger value="products">
              <Package className="mr-2 h-4 w-4" />
              Top Produkte
            </TabsTrigger>
          )}
          <TabsTrigger value="services">
            <Scissors className="mr-2 h-4 w-4" />
            Top Services
          </TabsTrigger>
        </TabsList>

        {features.shopEnabled && (
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Meistverkaufte Produkte</CardTitle>
                <CardDescription>
                  Nach Umsatz sortiert (letzte 30 Tage)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Verkauft</TableHead>
                      <TableHead className="text-right">Umsatz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          Keine Verkäufe in diesem Zeitraum
                        </TableCell>
                      </TableRow>
                    ) : (
                      topProducts.map((product, index) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-right">{product.totalSold}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(product.revenue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Beliebteste Services</CardTitle>
              <CardDescription>
                Nach Buchungen sortiert (letzte 30 Tage)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Buchungen</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        Keine Buchungen in diesem Zeitraum
                      </TableCell>
                    </TableRow>
                  ) : (
                    topServices.map((service, index) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-right">{service.bookings}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(service.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
