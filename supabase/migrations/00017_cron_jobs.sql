-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00017_cron_jobs.sql
-- Description: Setup Cron Jobs for automated tasks
-- ============================================

-- Enable pg_cron extension (if not already enabled)
-- Note: This requires Supabase Pro plan or self-hosted
-- For Free tier, use Supabase Edge Function with external scheduler

-- ============================================
-- CLEANUP EXPIRED RESERVATIONS (every 5 minutes)
-- ============================================

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Update all expired reservations to cancelled
  UPDATE appointments
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'Reservierung abgelaufen (Timeout)'
  WHERE
    status = 'reserved'
    AND reservation_expires_at < NOW();

  -- Get count of updated rows
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Log if any were cleaned up
  IF expired_count > 0 THEN
    INSERT INTO audit_logs (action, entity_type, details)
    VALUES (
      'cleanup_expired_reservations',
      'appointment',
      jsonb_build_object(
        'count', expired_count,
        'timestamp', NOW()
      )
    );
  END IF;

  RETURN expired_count;
END;
$$;

-- ============================================
-- AUDIT_LOGS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  actor_id UUID REFERENCES profiles(id),
  actor_type TEXT DEFAULT 'system',
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

COMMENT ON TABLE audit_logs IS 'Audit trail for critical actions';

-- ============================================
-- LEGAL DOCUMENTS TABLE
-- Store legal documents (AGB, Datenschutz, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'agb', 'datenschutz', 'widerruf'
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_legal_doc_version UNIQUE (salon_id, type, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_salon ON legal_documents(salon_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(type);

COMMENT ON TABLE legal_documents IS 'Legal documents (Terms, Privacy Policy, etc.)';

-- ============================================
-- LEGAL DOCUMENT ACCEPTANCE (for booking/checkout)
-- ============================================

CREATE TABLE IF NOT EXISTS legal_document_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  profile_id UUID REFERENCES profiles(id),
  legal_document_id UUID REFERENCES legal_documents(id),
  legal_document_type TEXT NOT NULL,
  legal_document_version INTEGER NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  appointment_id UUID REFERENCES appointments(id),
  order_id UUID REFERENCES orders(id),
  CONSTRAINT legal_acceptance_customer_or_profile CHECK (
    customer_id IS NOT NULL OR profile_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_customer ON legal_document_acceptances(customer_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_profile ON legal_document_acceptances(profile_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_appointment ON legal_document_acceptances(appointment_id);

-- ============================================
-- NO-SHOW FEE TRACKING
-- ============================================

-- Add no-show fee column to appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS no_show_fee_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_show_fee_charged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS no_show_fee_payment_id UUID;

COMMENT ON COLUMN appointments.no_show_fee_cents IS 'No-show fee amount charged to customer';
COMMENT ON COLUMN appointments.no_show_fee_charged_at IS 'When the no-show fee was charged';

-- ============================================
-- IDEMPOTENCY KEYS TABLE (for payment operations)
-- ============================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);

COMMENT ON TABLE idempotency_keys IS 'Ensures idempotent operations for payments and bookings';

-- Function to check/set idempotency
CREATE OR REPLACE FUNCTION check_idempotency(
  p_key TEXT,
  p_operation TEXT,
  p_entity_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  existing_result JSONB;
BEGIN
  -- Check for existing key
  SELECT result INTO existing_result
  FROM idempotency_keys
  WHERE key = p_key AND expires_at > NOW();

  -- If found, return existing result
  IF existing_result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'exists', true,
      'result', existing_result
    );
  END IF;

  -- Create new key entry (without result yet)
  INSERT INTO idempotency_keys (key, operation, entity_type)
  VALUES (p_key, p_operation, p_entity_type)
  ON CONFLICT (key) DO NOTHING;

  RETURN jsonb_build_object('exists', false);
END;
$$;

-- Function to set idempotency result
CREATE OR REPLACE FUNCTION set_idempotency_result(
  p_key TEXT,
  p_entity_id UUID,
  p_result JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE idempotency_keys
  SET entity_id = p_entity_id, result = p_result
  WHERE key = p_key;
END;
$$;

-- Cleanup old idempotency keys (daily)
CREATE OR REPLACE FUNCTION cleanup_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_document_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Audit logs: only service role
CREATE POLICY "Service role access audit_logs"
ON audit_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Legal acceptances: users can see their own
CREATE POLICY "Users can view own legal acceptances"
ON legal_document_acceptances FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Service role access legal_acceptances"
ON legal_document_acceptances FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Idempotency keys: only service role
CREATE POLICY "Service role access idempotency_keys"
ON idempotency_keys FOR ALL TO service_role
USING (true) WITH CHECK (true);
