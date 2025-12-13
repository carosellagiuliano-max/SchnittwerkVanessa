import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

// ============================================
// POST - Process Refund
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check admin role (only active staff)
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember || !['admin', 'hq'].includes(staffMember.role)) {
      return NextResponse.json(
        { error: 'Nur Admins können Erstattungen durchführen' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amountCents, reason } = body;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Ungültiger Erstattungsbetrag' },
        { status: 400 }
      );
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Bestellung nicht gefunden' },
        { status: 404 }
      );
    }

    // Check if already refunded
    if (order.payment_status === 'refunded') {
      return NextResponse.json(
        { error: 'Bestellung wurde bereits erstattet' },
        { status: 400 }
      );
    }

    // Check if payment was successful
    if (order.payment_status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Nur bezahlte Bestellungen können erstattet werden' },
        { status: 400 }
      );
    }

    // Check refund amount
    if (amountCents > order.total_cents) {
      return NextResponse.json(
        { error: 'Erstattungsbetrag übersteigt Bestellwert' },
        { status: 400 }
      );
    }

    // Get payment intent
    if (!order.payment_intent_id) {
      return NextResponse.json(
        { error: 'Keine Zahlungs-ID gefunden' },
        { status: 400 }
      );
    }

    // Process refund via Stripe
    let refund: Stripe.Refund;
    try {
      const stripe = getStripe();
      refund = await stripe.refunds.create({
        payment_intent: order.payment_intent_id,
        amount: amountCents,
        reason: 'requested_by_customer',
        metadata: {
          order_id: orderId,
          order_number: order.order_number,
          reason: reason || 'Admin-Erstattung',
        },
      });
    } catch (stripeError) {
      console.error('Stripe refund error:', stripeError);
      return NextResponse.json(
        { error: 'Stripe-Erstattung fehlgeschlagen' },
        { status: 500 }
      );
    }

    // Determine new payment status
    const isFullRefund = amountCents === order.total_cents;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
    const newOrderStatus = isFullRefund ? 'refunded' : order.status;

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: newPaymentStatus,
        status: newOrderStatus,
        refund_id: refund.id,
        refunded_amount_cents: (order.refunded_amount_cents || 0) + amountCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Order update error:', updateError);
      // Note: Refund was already processed in Stripe
    }

    // Log order event
    await supabase.from('order_events').insert({
      order_id: orderId,
      event_type: 'refunded',
      description: `Erstattung: CHF ${(amountCents / 100).toFixed(2)}${reason ? ` - ${reason}` : ''}`,
      created_by: staffMember.id,
    });

    // Log in payment_events if table exists
    await supabase.from('payment_events').insert({
      payment_intent_id: order.payment_intent_id,
      event_type: 'refund.created',
      status: refund.status,
      amount_cents: amountCents,
      metadata: {
        refund_id: refund.id,
        order_id: orderId,
        reason,
      },
    }).catch(() => {
      // Table might not exist
    });

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amountRefunded: amountCents,
      message: isFullRefund ? 'Vollständige Erstattung durchgeführt' : 'Teilerstattung durchgeführt',
    });
  } catch (error) {
    console.error('Refund error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
