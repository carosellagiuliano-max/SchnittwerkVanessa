import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getOrder } from '@/lib/actions/orders';
import { createServerClient } from '@/lib/supabase/server';
import {
  formatPrice,
  formatDate,
  formatDateTime,
  getStatusText,
  getPaymentStatusText,
} from '@/lib/domain/order/order';
import type { OrderStatus } from '@/lib/domain/order/types';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Bestelldetails',
  description: 'Details zu Ihrer Bestellung',
};

// ============================================
// HELPERS
// ============================================

function getStatusBadgeVariant(
  status: OrderStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid':
    case 'delivered':
    case 'completed':
      return 'default';
    case 'processing':
    case 'shipped':
      return 'secondary';
    case 'cancelled':
    case 'refunded':
      return 'destructive';
    default:
      return 'outline';
  }
}

// ============================================
// PAGE
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Get current user
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/konto/login?redirect=/konto/bestellungen/${id}`);
  }

  // Get order
  const { data: order, error } = await getOrder(id);

  if (error || !order) {
    notFound();
  }

  // Verify user owns this order
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (!customer || order.customerId !== customer.id) {
    notFound();
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/konto/bestellungen">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zu Bestellungen
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Bestellung {order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Bestellt am {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(order.status)} className="w-fit">
          {getStatusText(order.status)}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Bestellte Artikel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 py-4 border-b last:border-0"
                  >
                    {/* Icon/Image */}
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {item.itemType === 'voucher' ? (
                        <Gift className="h-8 w-8 text-primary" />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <h4 className="font-medium">{item.itemName}</h4>
                      {item.itemDescription && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.itemDescription}
                        </p>
                      )}
                      {item.itemType === 'voucher' && item.recipientEmail && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Empfänger: {item.recipientName || item.recipientEmail}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Menge: {item.quantity} × {formatPrice(item.unitPriceCents)}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(item.totalCents)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          {order.shippingMethod && order.shippingMethod !== 'none' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Versand
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.shippingMethod === 'pickup' ? (
                  <div>
                    <p className="font-medium">Abholung im Salon</p>
                    <p className="text-sm text-muted-foreground">
                      Bitte holen Sie Ihre Bestellung zu unseren Öffnungszeiten ab.
                    </p>
                  </div>
                ) : order.shippingAddress ? (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{order.shippingAddress.name}</p>
                      <p className="text-muted-foreground">
                        {order.shippingAddress.street}
                        {order.shippingAddress.street2 && (
                          <>
                            <br />
                            {order.shippingAddress.street2}
                          </>
                        )}
                        <br />
                        {order.shippingAddress.zip} {order.shippingAddress.city}
                        <br />
                        {order.shippingAddress.country}
                      </p>
                    </div>
                  </div>
                ) : null}

                {order.trackingNumber && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">
                      Sendungsnummer
                    </p>
                    <p className="font-mono font-medium">{order.trackingNumber}</p>
                    {/* Add tracking link if available */}
                  </div>
                )}

                {order.shippedAt && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Versendet am {formatDate(order.shippedAt)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Bestellverlauf
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Created */}
                <TimelineItem
                  icon={<Package className="h-4 w-4" />}
                  title="Bestellung aufgegeben"
                  date={order.createdAt}
                  isActive
                />

                {/* Paid */}
                {order.paidAt && (
                  <TimelineItem
                    icon={<Receipt className="h-4 w-4" />}
                    title="Zahlung erhalten"
                    date={order.paidAt}
                    isActive
                  />
                )}

                {/* Shipped */}
                {order.shippedAt && (
                  <TimelineItem
                    icon={<Truck className="h-4 w-4" />}
                    title="Bestellung versendet"
                    date={order.shippedAt}
                    isActive
                  />
                )}

                {/* Delivered */}
                {order.deliveredAt && (
                  <TimelineItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    title="Zugestellt"
                    date={order.deliveredAt}
                    isActive
                  />
                )}

                {/* Completed */}
                {order.completedAt && (
                  <TimelineItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    title="Abgeschlossen"
                    date={order.completedAt}
                    isActive
                  />
                )}

                {/* Cancelled */}
                {order.cancelledAt && (
                  <TimelineItem
                    icon={<XCircle className="h-4 w-4" />}
                    title="Storniert"
                    date={order.cancelledAt}
                    isActive
                    variant="destructive"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span>{formatPrice(order.subtotalCents)}</span>
              </div>

              {order.discountCents > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Rabatt</span>
                  <span>-{formatPrice(order.discountCents)}</span>
                </div>
              )}

              {order.voucherDiscountCents > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Gutschein</span>
                  <span>-{formatPrice(order.voucherDiscountCents)}</span>
                </div>
              )}

              {order.shippingCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Versand</span>
                  <span>{formatPrice(order.shippingCents)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-semibold">
                <span>Gesamtbetrag</span>
                <span>{formatPrice(order.totalCents)}</span>
              </div>

              <p className="text-xs text-muted-foreground text-right">
                inkl. {formatPrice(order.taxCents)} MwSt.
              </p>

              {order.refundedAmountCents > 0 && (
                <div className="flex justify-between text-sm text-destructive pt-2 border-t">
                  <span>Erstattet</span>
                  <span>-{formatPrice(order.refundedAmountCents)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle>Zahlungsstatus</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={
                  order.paymentStatus === 'succeeded'
                    ? 'default'
                    : order.paymentStatus === 'failed' ||
                      order.paymentStatus === 'refunded'
                    ? 'destructive'
                    : 'outline'
                }
              >
                {getPaymentStatusText(order.paymentStatus)}
              </Badge>
              {order.paidAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  Bezahlt am {formatDate(order.paidAt)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Fragen zu Ihrer Bestellung?
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/kontakt">
                  Kontakt aufnehmen
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TIMELINE ITEM COMPONENT
// ============================================

interface TimelineItemProps {
  icon: React.ReactNode;
  title: string;
  date: Date;
  isActive?: boolean;
  variant?: 'default' | 'destructive';
}

function TimelineItem({
  icon,
  title,
  date,
  isActive = false,
  variant = 'default',
}: TimelineItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isActive
            ? variant === 'destructive'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{formatDateTime(date)}</p>
      </div>
    </div>
  );
}
