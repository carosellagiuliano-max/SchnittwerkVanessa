import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ============================================
// STRIPE WEBHOOK HANDLER
// Handles Stripe webhook events with idempotency
// ============================================

// Initialize Stripe (lazy initialization to avoid build-time errors)
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

// Initialize Supabase Admin Client (lazy initialization to avoid build-time errors)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or Service Role Key is not configured');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Webhook secret for signature verification
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

// ============================================
// TYPES
// ============================================

interface WebhookResult {
  success: boolean;
  message: string;
  orderId?: string;
}

// ============================================
// LOGGING HELPER
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });
  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let eventId: string | undefined;
  let eventType: string | undefined;

  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      log('warn', 'Webhook received without signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'Webhook signature verification failed', { error: errMsg });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    eventId = event.id;
    eventType = event.type;

    log('info', 'Webhook received', { eventId, eventType });

    // Check idempotency - has this event already been processed?
    const { data: existingEvent } = await getSupabaseAdmin()
      .from('stripe_webhooks_log')
      .select('id, processed')
      .eq('stripe_event_id', eventId)
      .single();

    if (existingEvent?.processed) {
      log('info', 'Event already processed, skipping', { eventId });
      return NextResponse.json({ received: true, skipped: true });
    }

    // Log the event (or update if exists but not processed)
    if (!existingEvent) {
      await getSupabaseAdmin().from('stripe_webhooks_log').insert({
        stripe_event_id: eventId,
        event_type: eventType,
        payload: event.data.object as unknown as Record<string, unknown>,
        processed: false,
      });
    }

    // Process the event based on type
    let result: WebhookResult;

    switch (eventType) {
      case 'checkout.session.completed':
        result = await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'checkout.session.expired':
        result = await handleCheckoutSessionExpired(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'payment_intent.succeeded':
        result = await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.payment_failed':
        result = await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'charge.refunded':
        result = await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        result = await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case 'charge.dispute.closed':
        result = await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      default:
        log('info', 'Unhandled event type', { eventType });
        result = { success: true, message: `Unhandled event type: ${eventType}` };
    }

    // Mark event as processed
    const processingTime = Date.now() - startTime;
    await getSupabaseAdmin()
      .from('stripe_webhooks_log')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_result: result.success ? 'success' : 'failed',
        error: result.success ? null : result.message,
      })
      .eq('stripe_event_id', eventId);

    log('info', 'Webhook processed', {
      eventId,
      eventType,
      success: result.success,
      processingTime,
      orderId: result.orderId,
    });

    return NextResponse.json({
      received: true,
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Webhook processing error', { eventId, eventType, error: message });

    // Log error to database if we have an event ID
    if (eventId) {
      await getSupabaseAdmin()
        .from('stripe_webhooks_log')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_result: 'error',
          error: message,
        })
        .eq('stripe_event_id', eventId);
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle successful checkout session
 * This is the main event for completed purchases
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<WebhookResult> {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    log('warn', 'Checkout session without order_id', { sessionId: session.id });
    return { success: false, message: 'Missing order_id in metadata' };
  }

  try {
    // Update order using database function
    const { error } = await getSupabaseAdmin().rpc('handle_payment_success', {
      p_order_id: orderId,
      p_stripe_session_id: session.id,
      p_stripe_payment_intent_id:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
    });

    if (error) {
      log('error', 'Failed to update order', { orderId, error: error.message });
      return { success: false, message: error.message, orderId };
    }

    // Get order details for email
    const { data: order } = await getSupabaseAdmin()
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (order) {
      // Send confirmation email (async, don't await)
      sendOrderConfirmationEmailAsync(order).catch((err) => {
        log('error', 'Failed to send confirmation email', {
          orderId,
          error: err.message,
        });
      });

      // Process voucher items - generate codes and send emails
      await processVoucherItems(order);
    }

    log('info', 'Order payment confirmed', {
      orderId,
      sessionId: session.id,
      amount: session.amount_total,
    });

    return {
      success: true,
      message: 'Payment confirmed and order updated',
      orderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message, orderId };
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session
): Promise<WebhookResult> {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    return { success: true, message: 'No order to update' };
  }

  try {
    // Update order status to expired/cancelled
    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update({
        status: 'cancelled',
        payment_status: 'expired',
        cancellation_reason: 'Zahlungszeit abgelaufen',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending'); // Only update if still pending

    if (error) {
      log('error', 'Failed to expire order', { orderId, error: error.message });
      return { success: false, message: error.message, orderId };
    }

    // Record status change
    await getSupabaseAdmin().from('order_status_history').insert({
      order_id: orderId,
      previous_status: 'pending',
      new_status: 'cancelled',
      notes: 'Checkout-Session abgelaufen',
    });

    log('info', 'Order expired due to checkout timeout', { orderId });

    return {
      success: true,
      message: 'Order marked as expired',
      orderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message, orderId };
  }
}

/**
 * Handle successful payment intent
 * Used for custom payment flows (not Checkout)
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    // This might be a standalone payment, not tied to an order
    log('info', 'Payment intent without order_id', { paymentIntentId: paymentIntent.id });
    return { success: true, message: 'No order to update' };
  }

  try {
    const { error } = await getSupabaseAdmin().rpc('handle_payment_success', {
      p_order_id: orderId,
      p_stripe_payment_intent_id: paymentIntent.id,
      p_stripe_charge_id: typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id,
    });

    if (error) {
      return { success: false, message: error.message, orderId };
    }

    log('info', 'Payment intent succeeded', { orderId, paymentIntentId: paymentIntent.id });

    return {
      success: true,
      message: 'Payment confirmed',
      orderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message, orderId };
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const orderId = paymentIntent.metadata?.order_id;

  if (!orderId) {
    return { success: true, message: 'No order to update' };
  }

  try {
    const errorMessage =
      paymentIntent.last_payment_error?.message || 'Zahlung fehlgeschlagen';

    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update({
        payment_status: 'failed',
        payment_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      return { success: false, message: error.message, orderId };
    }

    // Get order for email
    const { data: order } = await getSupabaseAdmin()
      .from('orders')
      .select('customer_email, customer_name, order_number, total_cents')
      .eq('id', orderId)
      .single();

    if (order) {
      // Send payment failed email (async)
      sendPaymentFailedEmailAsync(order).catch((err) => {
        log('error', 'Failed to send payment failed email', {
          orderId,
          error: err.message,
        });
      });
    }

    log('info', 'Payment intent failed', {
      orderId,
      paymentIntentId: paymentIntent.id,
      error: errorMessage,
    });

    return {
      success: true,
      message: 'Order updated with payment failure',
      orderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message, orderId };
  }
}

/**
 * Handle refunded charge
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookResult> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    return { success: true, message: 'No payment intent to track' };
  }

  try {
    // Find order by payment intent
    const { data: order } = await getSupabaseAdmin()
      .from('orders')
      .select('id, status, total_cents, refunded_amount_cents')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!order) {
      // Try to find by charge ID
      const { data: orderByCharge } = await getSupabaseAdmin()
        .from('orders')
        .select('id, status, total_cents, refunded_amount_cents')
        .eq('stripe_charge_id', charge.id)
        .single();

      if (!orderByCharge) {
        log('warn', 'Refund for unknown order', { chargeId: charge.id });
        return { success: true, message: 'No matching order found' };
      }
    }

    const targetOrder = order;
    if (!targetOrder) {
      return { success: true, message: 'No matching order found' };
    }

    const orderId = targetOrder.id;
    const refundedAmount = charge.amount_refunded;
    const isFullRefund = charge.refunded;

    // Update order
    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update({
        refunded_amount_cents: refundedAmount,
        status: isFullRefund ? 'refunded' : targetOrder.status,
        payment_status: isFullRefund ? 'refunded' : 'partial_refund',
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      return { success: false, message: error.message, orderId };
    }

    // Record refund in payment_events
    await getSupabaseAdmin().from('payment_events').insert({
      order_id: orderId,
      event_type: isFullRefund ? 'refund' : 'partial_refund',
      amount_cents: refundedAmount,
      stripe_event_id: charge.id,
      metadata: {
        reason: charge.refunds?.data?.[0]?.reason || 'requested_by_customer',
      },
    });

    // Record status change
    await getSupabaseAdmin().from('order_status_history').insert({
      order_id: orderId,
      new_status: isFullRefund ? 'refunded' : 'partial_refund',
      notes: `Rückerstattung: CHF ${(refundedAmount / 100).toFixed(2)}`,
    });

    // Get order for email
    const { data: fullOrder } = await getSupabaseAdmin()
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (fullOrder) {
      sendRefundEmailAsync(fullOrder, refundedAmount, !isFullRefund).catch((err) => {
        log('error', 'Failed to send refund email', { orderId, error: err.message });
      });
    }

    log('info', 'Refund processed', {
      orderId,
      chargeId: charge.id,
      amount: refundedAmount,
      isFullRefund,
    });

    return {
      success: true,
      message: `Refund of ${refundedAmount} cents processed`,
      orderId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

/**
 * Handle dispute created
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<WebhookResult> {
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

  if (!chargeId) {
    return { success: true, message: 'No charge to track' };
  }

  try {
    // Find order by charge
    const { data: order } = await getSupabaseAdmin()
      .from('orders')
      .select('id')
      .eq('stripe_charge_id', chargeId)
      .single();

    if (!order) {
      log('warn', 'Dispute for unknown order', { chargeId, disputeId: dispute.id });
      return { success: true, message: 'No matching order found' };
    }

    // Update order with dispute info
    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update({
        has_dispute: true,
        dispute_reason: dispute.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (error) {
      return { success: false, message: error.message, orderId: order.id };
    }

    // Record in payment_events
    await getSupabaseAdmin().from('payment_events').insert({
      order_id: order.id,
      event_type: 'dispute_created',
      amount_cents: dispute.amount,
      stripe_event_id: dispute.id,
      metadata: {
        reason: dispute.reason,
        status: dispute.status,
      },
    });

    log('warn', 'Dispute created for order', {
      orderId: order.id,
      disputeId: dispute.id,
      reason: dispute.reason,
      amount: dispute.amount,
    });

    return {
      success: true,
      message: 'Dispute recorded',
      orderId: order.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

/**
 * Handle dispute closed
 */
async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<WebhookResult> {
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

  if (!chargeId) {
    return { success: true, message: 'No charge to track' };
  }

  try {
    const { data: order } = await getSupabaseAdmin()
      .from('orders')
      .select('id')
      .eq('stripe_charge_id', chargeId)
      .single();

    if (!order) {
      return { success: true, message: 'No matching order found' };
    }

    const won = dispute.status === 'won';

    // Update order
    const updateData: Record<string, unknown> = {
      has_dispute: !won, // Keep dispute flag if lost
      updated_at: new Date().toISOString(),
    };

    // If dispute was lost, mark as charged back
    if (!won) {
      updateData.payment_status = 'charged_back';
      updateData.status = 'cancelled';
    }

    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (error) {
      return { success: false, message: error.message, orderId: order.id };
    }

    // Record in payment_events
    await getSupabaseAdmin().from('payment_events').insert({
      order_id: order.id,
      event_type: won ? 'dispute_won' : 'dispute_lost',
      amount_cents: dispute.amount,
      stripe_event_id: dispute.id,
      metadata: {
        status: dispute.status,
      },
    });

    log('info', 'Dispute closed', {
      orderId: order.id,
      disputeId: dispute.id,
      status: dispute.status,
      won,
    });

    return {
      success: true,
      message: `Dispute ${won ? 'won' : 'lost'}`,
      orderId: order.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

// ============================================
// EMAIL HELPERS (async fire-and-forget)
// ============================================

async function sendOrderConfirmationEmailAsync(order: Record<string, unknown>): Promise<void> {
  try {
    const { sendOrderConfirmationEmail } = await import('@/lib/email/order-emails');

    const orderItems = (order.order_items as Record<string, unknown>[]) || [];

    // Use any type to avoid complex type mapping - this is a fire-and-forget email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailOrder: any = {
      id: order.id,
      salonId: order.salon_id,
      customerId: order.customer_id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      subtotalCents: order.subtotal_cents || 0,
      discountCents: order.discount_cents || 0,
      shippingCents: order.shipping_cents || 0,
      taxCents: order.tax_cents || 0,
      totalCents: order.total_cents,
      voucherDiscountCents: order.voucher_discount_cents || 0,
      shippingMethod: order.shipping_method,
      shippingAddress: order.shipping_address,
      trackingNumber: order.tracking_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerNotes: order.customer_notes,
      refundedAmountCents: order.refunded_amount_cents || 0,
      hasDispute: order.has_dispute || false,
      source: order.source || 'online',
      createdAt: order.created_at ? new Date(order.created_at as string) : new Date(),
      updatedAt: order.updated_at ? new Date(order.updated_at as string) : new Date(),
      items: orderItems.map((item) => ({
        id: item.id,
        orderId: item.order_id,
        itemType: item.item_type,
        productId: item.product_id,
        itemName: item.item_name,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        discountCents: item.discount_cents || 0,
        totalCents: item.total_cents,
        taxRate: item.tax_rate,
        taxCents: item.tax_cents || 0,
        voucherType: item.voucher_type,
        recipientEmail: item.recipient_email,
        recipientName: item.recipient_name,
        personalMessage: item.personal_message,
      })),
    };

    await sendOrderConfirmationEmail({
      order: emailOrder,
      salonName: 'SCHNITTWERK',
    });
  } catch (err) {
    log('error', 'sendOrderConfirmationEmailAsync failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

async function sendPaymentFailedEmailAsync(order: Record<string, unknown>): Promise<void> {
  try {
    const { sendPaymentFailedEmail } = await import('@/lib/email/order-emails');

    await sendPaymentFailedEmail({
      order: {
        id: '',
        orderNumber: order.order_number as string,
        customerEmail: order.customer_email as string,
        customerName: order.customer_name as string,
        totalCents: (order.total_cents as number) || 0,
        items: [],
      } as any,
      salonName: 'SCHNITTWERK',
    });
  } catch (err) {
    log('error', 'sendPaymentFailedEmailAsync failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

async function sendRefundEmailAsync(
  order: Record<string, unknown>,
  refundAmount: number,
  isPartial: boolean
): Promise<void> {
  try {
    const { sendRefundConfirmationEmail } = await import('@/lib/email/order-emails');

    await sendRefundConfirmationEmail({
      order: {
        id: order.id as string,
        orderNumber: order.order_number as string,
        customerEmail: order.customer_email as string,
        customerName: order.customer_name as string,
        totalCents: order.total_cents as number,
        paymentStatus: order.payment_status as string,
        items: [],
      } as any,
      refundAmount,
      isPartial,
      salonName: 'SCHNITTWERK',
    });
  } catch (err) {
    log('error', 'sendRefundEmailAsync failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

// ============================================
// VOUCHER PROCESSING
// ============================================

async function processVoucherItems(order: Record<string, unknown>): Promise<void> {
  const orderItems = (order.order_items as Record<string, unknown>[]) || [];
  const voucherItems = orderItems.filter(
    (item) => item.item_type === 'voucher' || item.voucher_type
  );

  if (voucherItems.length === 0) return;

  for (const item of voucherItems) {
    try {
      // Generate voucher code
      const { data: code, error: codeError } = await getSupabaseAdmin().rpc(
        'generate_voucher_code',
        { p_salon_id: order.salon_id }
      );

      if (codeError || !code) {
        log('error', 'Failed to generate voucher code', {
          orderId: order.id as string,
          itemId: item.id as string,
        });
        continue;
      }

      // Calculate expiry (1 year)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Create voucher in database
      const { data: voucher, error: voucherError } = await getSupabaseAdmin()
        .from('vouchers')
        .insert({
          salon_id: order.salon_id,
          code,
          type: 'gift_card',
          initial_value_cents: item.total_cents,
          remaining_value_cents: item.total_cents,
          amount_cents: item.total_cents,
          recipient_email: item.recipient_email,
          recipient_name: item.recipient_name,
          personal_message: item.personal_message,
          purchased_by_customer_id: order.customer_id,
          order_id: order.id,
          order_item_id: item.id,
          valid_until: expiresAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
          status: 'active',
        })
        .select()
        .single();

      if (voucherError) {
        log('error', 'Failed to create voucher', {
          orderId: order.id as string,
          itemId: item.id as string,
          error: voucherError.message,
        });
        continue;
      }

      // Update order item with voucher ID
      await getSupabaseAdmin()
        .from('order_items')
        .update({ voucher_id: voucher.id })
        .eq('id', item.id);

      // Send voucher email to recipient
      if (item.recipient_email) {
        try {
          const { sendVoucherToRecipient } = await import('@/lib/email/order-emails');
          await sendVoucherToRecipient(item.recipient_email as string, {
            voucherCode: code,
            amount: item.total_cents as number,
            recipientName: item.recipient_name as string,
            senderName: order.customer_name as string,
            personalMessage: item.personal_message as string,
            expiresAt,
            salonName: 'SCHNITTWERK',
          });

          log('info', 'Voucher email sent', {
            voucherId: voucher.id,
            recipientEmail: item.recipient_email,
          });
        } catch (emailErr) {
          log('error', 'Failed to send voucher email', {
            voucherId: voucher.id,
            error: emailErr instanceof Error ? emailErr.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      log('error', 'Error processing voucher item', {
        orderId: order.id as string,
        itemId: item.id as string,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// ============================================
// DISABLE OTHER HTTP METHODS
// ============================================

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
