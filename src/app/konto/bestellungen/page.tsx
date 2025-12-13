import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Package,
  ChevronRight,
  ShoppingBag,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCustomerOrders } from '@/lib/actions/orders';
import { createServerClient } from '@/lib/supabase/server';
import { formatPrice, formatDate } from '@/lib/domain/order/order';
import type { OrderStatus } from '@/lib/domain/order/types';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Meine Bestellungen',
  description: 'Uebersicht ueber Ihre Bestellungen',
};

// ============================================
// HELPERS
// ============================================

function getStatusIcon(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4" />;
    case 'paid':
    case 'processing':
      return <Package className="h-4 w-4" />;
    case 'shipped':
      return <Truck className="h-4 w-4" />;
    case 'delivered':
    case 'completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'cancelled':
    case 'refunded':
      return <XCircle className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

function getStatusBadge(status: OrderStatus) {
  const statusConfig: Record<
    OrderStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
  > = {
    pending: { label: 'Ausstehend', variant: 'outline', className: 'border-amber-500/50 text-amber-600 bg-amber-500/10' },
    paid: { label: 'Bezahlt', variant: 'default', className: 'bg-emerald-500/10 text-emerald-600 border-0' },
    processing: { label: 'In Bearbeitung', variant: 'secondary', className: 'bg-blue-500/10 text-blue-600 border-0' },
    shipped: { label: 'Versendet', variant: 'secondary', className: 'bg-purple-500/10 text-purple-600 border-0' },
    delivered: { label: 'Zugestellt', variant: 'default', className: 'bg-emerald-500/10 text-emerald-600 border-0' },
    completed: { label: 'Abgeschlossen', variant: 'default', className: 'bg-emerald-500/10 text-emerald-600 border-0' },
    cancelled: { label: 'Storniert', variant: 'destructive', className: 'bg-destructive/10 text-destructive border-0' },
    refunded: { label: 'Erstattet', variant: 'destructive', className: 'bg-destructive/10 text-destructive border-0' },
  };

  const config = statusConfig[status] || { label: status, variant: 'outline' as const };

  return (
    <Badge variant={config.variant} className={`gap-1.5 ${config.className || ''}`}>
      {getStatusIcon(status)}
      {config.label}
    </Badge>
  );
}

// ============================================
// PAGE
// ============================================

export default async function OrderHistoryPage() {
  // Get current user
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/konto/login?redirect=/konto/bestellungen');
  }

  // Get customer ID from user metadata or profile
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!customer) {
    return (
      <div className="container max-w-4xl py-12 md:py-16">
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3">Kein Kundenprofil gefunden</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Bitte vervollstaendigen Sie Ihr Profil, um Bestellungen zu sehen.
          </p>
          <Button asChild className="btn-glow rounded-full px-6">
            <Link href="/konto/profil">Profil vervollstaendigen</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Get all orders
  const { data: allOrders } = await getCustomerOrders(customer.id, { limit: 100 });

  // Separate active and past orders
  const activeStatuses: OrderStatus[] = ['pending', 'paid', 'processing', 'shipped'];
  const activeOrders = allOrders?.filter((o) => activeStatuses.includes(o.status)) || [];
  const pastOrders = allOrders?.filter((o) => !activeStatuses.includes(o.status)) || [];

  const hasOrders = (allOrders?.length || 0) > 0;

  return (
    <div className="container max-w-4xl py-12 md:py-16 animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Package className="h-4 w-4" />
          Bestellungen
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
          Meine{' '}
          <span className="text-gradient-primary">Bestellungen</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Uebersicht ueber alle Ihre Bestellungen
        </p>
      </div>

      {!hasOrders ? (
        // Empty State
        <Card className="card-elegant overflow-hidden">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Noch keine Bestellungen</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Sie haben noch keine Bestellungen aufgegeben. Entdecken Sie unsere Produkte und Gutscheine.
              </p>
              <Button asChild size="lg" className="btn-glow rounded-full px-8">
                <Link href="/shop">
                  Zum Shop
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="active"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Aktiv ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-300"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Vergangene ({pastOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Orders */}
          <TabsContent value="active" className="space-y-4">
            {activeOrders.length === 0 ? (
              <Card className="card-elegant">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground">
                    Keine aktiven Bestellungen
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeOrders.map((order, index) => (
                <OrderCard key={order.id} order={order} index={index} />
              ))
            )}
          </TabsContent>

          {/* Past Orders */}
          <TabsContent value="past" className="space-y-4">
            {pastOrders.length === 0 ? (
              <Card className="card-elegant">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground">
                    Keine vergangenen Bestellungen
                  </p>
                </CardContent>
              </Card>
            ) : (
              pastOrders.map((order, index) => (
                <OrderCard key={order.id} order={order} index={index} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================
// ORDER CARD COMPONENT
// ============================================

interface OrderCardProps {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalCents: number;
    itemCount: number;
    createdAt: Date;
    paidAt?: Date;
  };
  index: number;
}

function OrderCard({ order, index }: OrderCardProps) {
  return (
    <Card
      className="card-elegant group overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <CardContent className="p-0">
        <Link href={`/konto/bestellungen/${order.id}`} className="block p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono font-semibold text-primary">{order.orderNumber}</span>
                {getStatusBadge(order.status)}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(order.createdAt)}
                </span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  {order.itemCount} {order.itemCount === 1 ? 'Artikel' : 'Artikel'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{formatPrice(order.totalCents)}</p>
                {order.paidAt && (
                  <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {formatDate(order.paidAt)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary">
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
