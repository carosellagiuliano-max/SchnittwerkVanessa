-- ============================================
-- 00024: Web Push Subscriptions
-- SCHNITTWERK Phase 8 - Push Notifications
-- ============================================

-- ============================================
-- 1. PUSH SUBSCRIPTIONS TABLE
-- Store web push subscriptions per customer
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Push subscription data
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,

  -- Device info
  user_agent TEXT,
  device_type VARCHAR(20), -- 'mobile', 'desktop', 'tablet'

  -- Tracking
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate subscriptions per customer+endpoint
  CONSTRAINT unique_customer_endpoint
    UNIQUE (customer_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer
ON push_subscriptions(customer_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
ON push_subscriptions(endpoint);

-- Updated_at trigger
CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. PUSH NOTIFICATION LOGS
-- Track sent push notifications
-- ============================================

CREATE TABLE IF NOT EXISTS push_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id),
  customer_id UUID REFERENCES customers(id),
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,

  -- Notification details
  event_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'clicked', 'failed')),
  error_message TEXT,

  -- Reference
  reference_type VARCHAR(30),
  reference_id UUID,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_logs_customer
ON push_notification_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_push_logs_salon
ON push_notification_logs(salon_id);

CREATE INDEX IF NOT EXISTS idx_push_logs_event
ON push_notification_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_push_logs_sent_at
ON push_notification_logs(sent_at DESC);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own subscriptions
CREATE POLICY "Customers can manage own push subscriptions"
ON push_subscriptions FOR ALL
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE profile_id = auth.uid()
  )
);

-- Staff can view push logs for their salon
CREATE POLICY "Staff can view salon push logs"
ON push_notification_logs FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- ============================================
-- 4. VIEW: Push notification analytics
-- ============================================

CREATE OR REPLACE VIEW v_push_analytics AS
SELECT
  pnl.salon_id,
  pnl.event_type,
  DATE(pnl.sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE pnl.status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE pnl.status = 'clicked') as clicked,
  COUNT(*) FILTER (WHERE pnl.status = 'failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE pnl.status = 'clicked')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE pnl.status IN ('delivered', 'clicked')), 0) * 100,
    1
  ) as click_rate
FROM push_notification_logs pnl
GROUP BY pnl.salon_id, pnl.event_type, DATE(pnl.sent_at);

COMMENT ON VIEW v_push_analytics IS 'Push notification performance analytics';

-- ============================================
-- 5. FUNCTION: Clean up old/invalid subscriptions
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_invalid_push_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete subscriptions with too many errors or unused for 90+ days
  WITH deleted AS (
    DELETE FROM push_subscriptions
    WHERE error_count >= 5
       OR (last_used_at IS NOT NULL AND last_used_at < NOW() - INTERVAL '90 days')
       OR (last_used_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_invalid_push_subscriptions IS 'Remove stale or invalid push subscriptions';

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON TABLE push_subscriptions IS 'Web Push API subscription storage per customer device';
COMMENT ON TABLE push_notification_logs IS 'Log of sent push notifications';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'Public key for encryption';
COMMENT ON COLUMN push_subscriptions.auth_key IS 'Authentication secret';
