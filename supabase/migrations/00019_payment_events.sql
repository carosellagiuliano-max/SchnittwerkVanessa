-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00019_payment_events.sql
-- Description: Payment events tracking for webhooks
-- ============================================

-- ============================================
-- PAYMENT_EVENTS TABLE
-- Track all payment-related events (success, failure, refund, dispute)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,

  -- Event info
  event_type TEXT NOT NULL,
  -- event_type values:
  -- 'payment_succeeded', 'payment_failed', 'payment_expired'
  -- 'refund', 'partial_refund'
  -- 'dispute_created', 'dispute_won', 'dispute_lost'
  -- 'chargeback'

  -- Amount involved (for refunds/disputes)
  amount_cents INTEGER,

  -- Stripe references
  stripe_event_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  stripe_dispute_id TEXT,

  -- Additional data
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_events IS 'Payment event log for tracking all payment-related activities';
COMMENT ON COLUMN payment_events.event_type IS 'Type of payment event';
COMMENT ON COLUMN payment_events.stripe_event_id IS 'Original Stripe webhook event ID';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe ON payment_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_date ON payment_events(created_at);

-- RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view payment events for their salon
CREATE POLICY "Staff can view payment events"
  ON payment_events FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE salon_id IN (
        SELECT salon_id FROM staff WHERE profile_id = auth.uid()
      )
    )
    OR
    payment_id IN (
      SELECT id FROM payments WHERE salon_id IN (
        SELECT salon_id FROM staff WHERE profile_id = auth.uid()
      )
    )
  );

-- Policy: System can insert payment events (service role)
CREATE POLICY "System can insert payment events"
  ON payment_events FOR INSERT
  WITH CHECK (true);
