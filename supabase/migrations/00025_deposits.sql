-- ============================================
-- 00025: Appointment Deposits / Anzahlungen
-- SCHNITTWERK Phase 8 - Deposit System
-- ============================================

-- ============================================
-- 1. SERVICE DEPOSIT CONFIGURATION
-- Add deposit settings to services
-- ============================================

ALTER TABLE services
ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(20) DEFAULT 'percentage' CHECK (deposit_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS deposit_amount INTEGER DEFAULT 0, -- CHF cents for fixed, percentage for percentage type
ADD COLUMN IF NOT EXISTS deposit_refundable_until INTEGER DEFAULT 24; -- Hours before appointment

COMMENT ON COLUMN services.deposit_required IS 'Whether a deposit is required for booking this service';
COMMENT ON COLUMN services.deposit_type IS 'fixed = CHF amount, percentage = % of service price';
COMMENT ON COLUMN services.deposit_amount IS 'Amount in cents (fixed) or percentage (0-100)';
COMMENT ON COLUMN services.deposit_refundable_until IS 'Hours before appointment when deposit becomes non-refundable';

-- ============================================
-- 2. APPOINTMENT DEPOSITS TABLE
-- Track deposits for appointments
-- ============================================

CREATE TABLE IF NOT EXISTS appointment_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Deposit details
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'CHF',

  -- Payment
  stripe_payment_intent_id VARCHAR(100),
  stripe_charge_id VARCHAR(100),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',       -- Awaiting payment
    'paid',          -- Deposit received
    'applied',       -- Applied to final payment
    'refunded',      -- Refunded to customer
    'forfeited',     -- No-show or late cancellation
    'cancelled'      -- Cancelled before payment
  )),

  -- Refund tracking
  refund_amount_cents INTEGER,
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES profiles(id),

  -- Timestamps
  paid_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  forfeited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One deposit per appointment
  CONSTRAINT unique_appointment_deposit
    UNIQUE (appointment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointment_deposits_appointment
ON appointment_deposits(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_deposits_salon
ON appointment_deposits(salon_id);

CREATE INDEX IF NOT EXISTS idx_appointment_deposits_customer
ON appointment_deposits(customer_id);

CREATE INDEX IF NOT EXISTS idx_appointment_deposits_status
ON appointment_deposits(status);

CREATE INDEX IF NOT EXISTS idx_appointment_deposits_stripe
ON appointment_deposits(stripe_payment_intent_id);

-- Updated_at trigger
CREATE TRIGGER appointment_deposits_updated_at
BEFORE UPDATE ON appointment_deposits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. DEPOSIT POLICIES TABLE
-- Salon-wide deposit policies
-- ============================================

CREATE TABLE IF NOT EXISTS deposit_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Policy configuration
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Default settings
  default_type VARCHAR(20) DEFAULT 'percentage' CHECK (default_type IN ('fixed', 'percentage')),
  default_amount INTEGER DEFAULT 20, -- 20% or 20 CHF
  min_service_price_cents INTEGER DEFAULT 5000, -- Only require for services > CHF 50

  -- Refund policy
  full_refund_hours INTEGER DEFAULT 48, -- Full refund if cancelled 48h+ before
  partial_refund_hours INTEGER DEFAULT 24, -- Partial refund if cancelled 24-48h before
  partial_refund_percent INTEGER DEFAULT 50, -- 50% refund for partial

  -- No-show policy
  no_show_forfeit BOOLEAN DEFAULT true, -- Forfeit deposit on no-show

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active policy per salon (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_policy_per_salon
ON deposit_policies(salon_id) WHERE is_active = true;

COMMENT ON TABLE deposit_policies IS 'Salon-wide deposit and refund policies';

-- ============================================
-- 4. FUNCTIONS
-- ============================================

-- Calculate deposit amount for a service
CREATE OR REPLACE FUNCTION calculate_deposit_amount(
  p_service_id UUID,
  p_service_price_cents INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_service services%ROWTYPE;
  v_deposit_amount INTEGER;
BEGIN
  SELECT * INTO v_service FROM services WHERE id = p_service_id;

  IF NOT FOUND OR NOT v_service.deposit_required THEN
    RETURN 0;
  END IF;

  IF v_service.deposit_type = 'fixed' THEN
    v_deposit_amount := v_service.deposit_amount;
  ELSE
    -- Percentage
    v_deposit_amount := FLOOR(
      COALESCE(p_service_price_cents, v_service.price_cents) *
      v_service.deposit_amount / 100.0
    );
  END IF;

  RETURN v_deposit_amount;
END;
$$ LANGUAGE plpgsql;

-- Check if deposit is refundable
CREATE OR REPLACE FUNCTION is_deposit_refundable(
  p_appointment_id UUID
)
RETURNS TABLE (
  refundable BOOLEAN,
  refund_percent INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_appointment appointments%ROWTYPE;
  v_service services%ROWTYPE;
  v_hours_until NUMERIC;
BEGIN
  SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Appointment not found'::TEXT;
    RETURN;
  END IF;

  -- Get the first service from appointment_services
  SELECT s.* INTO v_service
  FROM services s
  JOIN appointment_services aps ON aps.service_id = s.id
  WHERE aps.appointment_id = p_appointment_id
  ORDER BY aps.sort_order
  LIMIT 1;

  -- Calculate hours until appointment
  v_hours_until := EXTRACT(EPOCH FROM (v_appointment.start_time - NOW())) / 3600;

  IF v_service.id IS NULL OR v_hours_until >= COALESCE(v_service.deposit_refundable_until, 24) THEN
    RETURN QUERY SELECT true, 100, 'Full refund eligible'::TEXT;
  ELSIF v_hours_until >= (COALESCE(v_service.deposit_refundable_until, 24) / 2) THEN
    RETURN QUERY SELECT true, 50, 'Partial refund eligible (50%)'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 0, 'Cancellation deadline passed'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create deposit for appointment
CREATE OR REPLACE FUNCTION create_appointment_deposit(
  p_appointment_id UUID,
  p_stripe_payment_intent_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_appointment appointments%ROWTYPE;
  v_service services%ROWTYPE;
  v_deposit_amount INTEGER;
  v_deposit_id UUID;
BEGIN
  SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Get the first service from appointment_services
  SELECT s.* INTO v_service
  FROM services s
  JOIN appointment_services aps ON aps.service_id = s.id
  WHERE aps.appointment_id = p_appointment_id
  ORDER BY aps.sort_order
  LIMIT 1;

  IF v_service.id IS NULL OR NOT v_service.deposit_required THEN
    RETURN NULL;
  END IF;

  v_deposit_amount := calculate_deposit_amount(v_service.id, v_service.price_cents);

  INSERT INTO appointment_deposits (
    appointment_id, salon_id, customer_id,
    amount_cents, stripe_payment_intent_id, status
  ) VALUES (
    p_appointment_id, v_appointment.salon_id, v_appointment.customer_id,
    v_deposit_amount, p_stripe_payment_intent_id,
    'pending'
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
    updated_at = NOW()
  RETURNING id INTO v_deposit_id;

  RETURN v_deposit_id;
END;
$$ LANGUAGE plpgsql;

-- Mark deposit as paid
CREATE OR REPLACE FUNCTION mark_deposit_paid(
  p_deposit_id UUID,
  p_stripe_charge_id VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE appointment_deposits
  SET
    status = 'paid',
    stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
    paid_at = NOW()
  WHERE id = p_deposit_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Process deposit refund
CREATE OR REPLACE FUNCTION process_deposit_refund(
  p_appointment_id UUID,
  p_reason TEXT DEFAULT 'Customer cancellation'
)
RETURNS TABLE (
  success BOOLEAN,
  refund_amount INTEGER,
  message TEXT
) AS $$
DECLARE
  v_deposit appointment_deposits%ROWTYPE;
  v_refund_info RECORD;
BEGIN
  SELECT * INTO v_deposit
  FROM appointment_deposits
  WHERE appointment_id = p_appointment_id
    AND status = 'paid'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'No paid deposit found'::TEXT;
    RETURN;
  END IF;

  -- Check refundability
  SELECT * INTO v_refund_info FROM is_deposit_refundable(p_appointment_id);

  IF NOT v_refund_info.refundable THEN
    -- Forfeit the deposit
    UPDATE appointment_deposits
    SET status = 'forfeited', forfeited_at = NOW()
    WHERE id = v_deposit.id;

    RETURN QUERY SELECT false, 0, v_refund_info.reason;
    RETURN;
  END IF;

  -- Calculate refund amount
  DECLARE
    v_refund_amount INTEGER;
  BEGIN
    v_refund_amount := FLOOR(v_deposit.amount_cents * v_refund_info.refund_percent / 100.0);

    UPDATE appointment_deposits
    SET
      status = 'refunded',
      refund_amount_cents = v_refund_amount,
      refund_reason = p_reason,
      refunded_at = NOW()
    WHERE id = v_deposit.id;

    RETURN QUERY SELECT true, v_refund_amount, v_refund_info.reason;
  END;
END;
$$ LANGUAGE plpgsql;

-- Apply deposit to final payment
CREATE OR REPLACE FUNCTION apply_deposit_to_payment(
  p_appointment_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_deposit appointment_deposits%ROWTYPE;
BEGIN
  UPDATE appointment_deposits
  SET status = 'applied', applied_at = NOW()
  WHERE appointment_id = p_appointment_id
    AND status = 'paid'
  RETURNING * INTO v_deposit;

  IF FOUND THEN
    RETURN v_deposit.amount_cents;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. VIEWS
-- ============================================

-- Pending deposits view
CREATE OR REPLACE VIEW v_pending_deposits AS
SELECT
  ad.*,
  a.start_time as appointment_starts_at,
  a.status as appointment_status,
  c.first_name || ' ' || c.last_name as customer_name,
  p.email as customer_email,
  p.phone as customer_phone,
  aps.service_name as service_name,
  EXTRACT(EPOCH FROM (a.start_time - NOW())) / 3600 as hours_until_appointment
FROM appointment_deposits ad
JOIN appointments a ON ad.appointment_id = a.id
JOIN customers c ON ad.customer_id = c.id
JOIN profiles p ON c.profile_id = p.id
LEFT JOIN LATERAL (
  SELECT service_name FROM appointment_services
  WHERE appointment_id = a.id
  ORDER BY sort_order LIMIT 1
) aps ON true
WHERE ad.status IN ('pending', 'paid');

COMMENT ON VIEW v_pending_deposits IS 'Active deposits with appointment details';

-- Deposit statistics view
CREATE OR REPLACE VIEW v_deposit_stats AS
SELECT
  ad.salon_id,
  DATE(ad.created_at) as date,
  COUNT(*) as total_deposits,
  COUNT(*) FILTER (WHERE ad.status = 'paid') as paid,
  COUNT(*) FILTER (WHERE ad.status = 'applied') as applied,
  COUNT(*) FILTER (WHERE ad.status = 'refunded') as refunded,
  COUNT(*) FILTER (WHERE ad.status = 'forfeited') as forfeited,
  SUM(ad.amount_cents) FILTER (WHERE ad.status IN ('paid', 'applied', 'forfeited')) as total_collected_cents,
  SUM(ad.refund_amount_cents) FILTER (WHERE ad.status = 'refunded') as total_refunded_cents
FROM appointment_deposits ad
GROUP BY ad.salon_id, DATE(ad.created_at);

COMMENT ON VIEW v_deposit_stats IS 'Deposit statistics by salon and date';

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE appointment_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_policies ENABLE ROW LEVEL SECURITY;

-- Customers can view their own deposits
CREATE POLICY "Customers can view own deposits"
ON appointment_deposits FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE profile_id = auth.uid()
  )
);

-- Staff can view salon deposits
CREATE POLICY "Staff can view salon deposits"
ON appointment_deposits FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Staff can manage deposits
CREATE POLICY "Staff can manage salon deposits"
ON appointment_deposits FOR ALL
TO authenticated
USING (
  salon_id IN (
    SELECT s.salon_id FROM staff s
    JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
    WHERE s.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager')
  )
);

-- Deposit policies: Admin only
CREATE POLICY "Admin can manage deposit policies"
ON deposit_policies FOR ALL
TO authenticated
USING (
  salon_id IN (
    SELECT s.salon_id FROM staff s
    JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
    WHERE s.profile_id = auth.uid()
    AND ur.role_name = 'admin'
  )
);

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE appointment_deposits IS 'Deposit payments for appointment bookings';
COMMENT ON FUNCTION calculate_deposit_amount IS 'Calculate required deposit for a service';
COMMENT ON FUNCTION is_deposit_refundable IS 'Check if a deposit can be refunded based on timing';
COMMENT ON FUNCTION process_deposit_refund IS 'Process a deposit refund with policy checks';
