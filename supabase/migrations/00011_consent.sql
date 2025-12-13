-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00011_consent.sql
-- Description: GDPR/DSG compliance, consent tracking
-- ============================================

-- ============================================
-- CONSENT_RECORDS TABLE
-- Track user consent for data processing
-- ============================================
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,

  -- Consent category
  category consent_category NOT NULL,

  -- Consent status
  consented BOOLEAN NOT NULL,

  -- Version of terms consented to
  terms_version TEXT,

  -- How consent was given
  consent_method TEXT DEFAULT 'web_form',
  -- Methods: web_form, checkbox, verbal, written, api

  -- IP address for audit trail
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE consent_records IS 'GDPR/DSG consent records';
COMMENT ON COLUMN consent_records.category IS 'What the consent is for';
COMMENT ON COLUMN consent_records.terms_version IS 'Version of privacy policy/terms';
COMMENT ON COLUMN consent_records.consent_method IS 'How consent was obtained';

-- Indexes
CREATE INDEX idx_consent_records_profile ON consent_records(profile_id);
CREATE INDEX idx_consent_records_salon ON consent_records(salon_id);
CREATE INDEX idx_consent_records_category ON consent_records(profile_id, category);
CREATE INDEX idx_consent_records_active ON consent_records(profile_id, category)
  WHERE consented = true AND revoked_at IS NULL;

-- ============================================
-- DATA_EXPORT_REQUESTS TABLE
-- Track GDPR data export requests
-- ============================================
CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Request status
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending, processing, completed, failed, expired

  -- Request details
  request_type TEXT NOT NULL DEFAULT 'export',
  -- Types: export, delete

  -- Processing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Result
  export_file_url TEXT,
  export_expires_at TIMESTAMPTZ,

  -- Error
  error_message TEXT,

  -- Request metadata
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE data_export_requests IS 'GDPR data export/deletion requests';
COMMENT ON COLUMN data_export_requests.status IS 'Request processing status';

-- Indexes
CREATE INDEX idx_data_export_requests_profile ON data_export_requests(profile_id);
CREATE INDEX idx_data_export_requests_status ON data_export_requests(status)
  WHERE status IN ('pending', 'processing');

-- ============================================
-- DATA_RETENTION_POLICIES TABLE
-- Configure data retention per salon
-- ============================================
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Data type
  data_type TEXT NOT NULL,
  -- Types: appointments, orders, customers_inactive, audit_logs, notifications

  -- Retention period in days
  retention_days INTEGER NOT NULL,

  -- What to do after retention period
  action TEXT NOT NULL DEFAULT 'anonymize',
  -- Actions: delete, anonymize, archive

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_retention_policy UNIQUE (salon_id, data_type),
  CONSTRAINT positive_retention CHECK (retention_days > 0)
);

COMMENT ON TABLE data_retention_policies IS 'Data retention configuration';
COMMENT ON COLUMN data_retention_policies.action IS 'What to do with expired data';

-- Indexes
CREATE INDEX idx_data_retention_salon ON data_retention_policies(salon_id);

-- Apply updated_at trigger
CREATE TRIGGER update_data_retention_updated_at
  BEFORE UPDATE ON data_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Check if consent is given
-- ============================================
CREATE OR REPLACE FUNCTION has_consent(
  p_profile_id UUID,
  p_category consent_category,
  p_salon_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM consent_records
    WHERE profile_id = p_profile_id
      AND category = p_category
      AND consented = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (p_salon_id IS NULL OR salon_id = p_salon_id OR salon_id IS NULL)
    ORDER BY consented_at DESC
    LIMIT 1
  );
$$ LANGUAGE sql STABLE;

-- ============================================
-- FUNCTION: Record consent
-- ============================================
CREATE OR REPLACE FUNCTION record_consent(
  p_profile_id UUID,
  p_category consent_category,
  p_consented BOOLEAN,
  p_salon_id UUID DEFAULT NULL,
  p_terms_version TEXT DEFAULT NULL,
  p_consent_method TEXT DEFAULT 'web_form',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_consent_id UUID;
BEGIN
  -- Revoke previous consent for this category
  UPDATE consent_records
  SET revoked_at = NOW()
  WHERE profile_id = p_profile_id
    AND category = p_category
    AND (p_salon_id IS NULL OR salon_id = p_salon_id)
    AND revoked_at IS NULL;

  -- Record new consent
  INSERT INTO consent_records (
    profile_id, salon_id, category, consented,
    terms_version, consent_method, ip_address, user_agent
  ) VALUES (
    p_profile_id, p_salon_id, p_category, p_consented,
    p_terms_version, p_consent_method, p_ip_address, p_user_agent
  )
  RETURNING id INTO new_consent_id;

  RETURN new_consent_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Revoke consent
-- ============================================
CREATE OR REPLACE FUNCTION revoke_consent(
  p_profile_id UUID,
  p_category consent_category,
  p_salon_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE consent_records
  SET revoked_at = NOW()
  WHERE profile_id = p_profile_id
    AND category = p_category
    AND (p_salon_id IS NULL OR salon_id = p_salon_id)
    AND revoked_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create data export request
-- ============================================
CREATE OR REPLACE FUNCTION create_data_export_request(
  p_profile_id UUID,
  p_request_type TEXT DEFAULT 'export',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_request_id UUID;
  existing_request RECORD;
BEGIN
  -- Check for existing pending request
  SELECT * INTO existing_request
  FROM data_export_requests
  WHERE profile_id = p_profile_id
    AND status IN ('pending', 'processing')
    AND created_at > NOW() - INTERVAL '24 hours';

  IF FOUND THEN
    RAISE EXCEPTION 'A request is already pending';
  END IF;

  -- Create new request
  INSERT INTO data_export_requests (
    profile_id, request_type, ip_address, user_agent
  ) VALUES (
    p_profile_id, p_request_type, p_ip_address, p_user_agent
  )
  RETURNING id INTO new_request_id;

  RETURN new_request_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Export user data (GDPR)
-- ============================================
CREATE OR REPLACE FUNCTION export_user_data(p_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  profile_data JSONB;
  customer_data JSONB;
  appointments_data JSONB;
  orders_data JSONB;
  consent_data JSONB;
BEGIN
  -- Profile
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'first_name', first_name,
    'last_name', last_name,
    'phone', phone,
    'created_at', created_at
  ) INTO profile_data
  FROM profiles WHERE id = p_profile_id;

  -- Customer records
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'salon_id', c.salon_id,
    'first_name', c.first_name,
    'last_name', c.last_name,
    'birthday', c.birthday,
    'created_at', c.created_at
  )), '[]'::jsonb) INTO customer_data
  FROM customers c WHERE c.profile_id = p_profile_id;

  -- Appointments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'start_time', a.start_time,
    'status', a.status,
    'total_cents', a.total_cents,
    'created_at', a.created_at
  )), '[]'::jsonb) INTO appointments_data
  FROM appointments a
  JOIN customers c ON a.customer_id = c.id
  WHERE c.profile_id = p_profile_id;

  -- Orders
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'total_cents', o.total_cents,
    'status', o.status,
    'created_at', o.created_at
  )), '[]'::jsonb) INTO orders_data
  FROM orders o
  JOIN customers c ON o.customer_id = c.id
  WHERE c.profile_id = p_profile_id;

  -- Consent records
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category', category,
    'consented', consented,
    'consented_at', consented_at,
    'revoked_at', revoked_at
  )), '[]'::jsonb) INTO consent_data
  FROM consent_records WHERE profile_id = p_profile_id;

  -- Build result
  result := jsonb_build_object(
    'exported_at', NOW(),
    'profile', profile_data,
    'customers', customer_data,
    'appointments', appointments_data,
    'orders', orders_data,
    'consents', consent_data
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Anonymize customer data
-- ============================================
CREATE OR REPLACE FUNCTION anonymize_customer(p_customer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  customer_record RECORD;
BEGIN
  -- Get customer
  SELECT * INTO customer_record FROM customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Anonymize customer
  UPDATE customers
  SET
    first_name = 'Anonymisiert',
    last_name = 'Kunde',
    birthday = NULL,
    notes = NULL,
    hair_notes = NULL,
    is_active = false,
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Don't delete appointments/orders - keep for business records
  -- but anonymize customer notes
  UPDATE appointments
  SET customer_notes = NULL, internal_notes = NULL
  WHERE customer_id = p_customer_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Apply data retention policies
-- (Called by cron job)
-- ============================================
CREATE OR REPLACE FUNCTION apply_data_retention()
RETURNS TABLE (
  salon_id UUID,
  data_type TEXT,
  records_affected INTEGER
) AS $$
DECLARE
  policy RECORD;
  affected INTEGER;
BEGIN
  FOR policy IN
    SELECT * FROM data_retention_policies WHERE is_active = true
  LOOP
    affected := 0;

    CASE policy.data_type
      WHEN 'customers_inactive' THEN
        -- Anonymize inactive customers
        IF policy.action = 'anonymize' THEN
          WITH updated AS (
            UPDATE customers
            SET
              first_name = 'Anonymisiert',
              last_name = 'Kunde',
              birthday = NULL,
              notes = NULL,
              hair_notes = NULL
            WHERE salon_id = policy.salon_id
              AND is_active = false
              AND last_visit_at < NOW() - (policy.retention_days || ' days')::INTERVAL
              AND first_name != 'Anonymisiert'
            RETURNING id
          )
          SELECT COUNT(*) INTO affected FROM updated;
        END IF;

      WHEN 'notifications' THEN
        -- Delete old notifications
        IF policy.action = 'delete' THEN
          WITH deleted AS (
            DELETE FROM notifications
            WHERE salon_id = policy.salon_id
              AND created_at < NOW() - (policy.retention_days || ' days')::INTERVAL
            RETURNING id
          )
          SELECT COUNT(*) INTO affected FROM deleted;
        END IF;

      ELSE
        -- Other data types - implement as needed
        affected := 0;
    END CASE;

    IF affected > 0 THEN
      salon_id := policy.salon_id;
      data_type := policy.data_type;
      records_affected := affected;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Current consents per user
-- ============================================
CREATE VIEW v_user_consents AS
SELECT DISTINCT ON (profile_id, category)
  profile_id,
  category,
  consented,
  consented_at,
  revoked_at,
  CASE
    WHEN revoked_at IS NOT NULL THEN false
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN false
    ELSE consented
  END AS is_active
FROM consent_records
ORDER BY profile_id, category, consented_at DESC;

COMMENT ON VIEW v_user_consents IS 'Current consent status per user';

-- ============================================
-- Default retention policies (insert for each salon)
-- ============================================
-- These will be created per-salon when salon is created
