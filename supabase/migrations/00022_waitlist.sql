-- ============================================
-- 00022: Waitlist Enhancements
-- SCHNITTWERK Phase 8 - Waitlist RLS and Functions
-- Note: The waitlist table is already created in 00005_booking.sql
-- This migration adds RLS policies and helper functions only
-- ============================================

-- ============================================
-- 1. RLS POLICIES FOR WAITLIST
-- ============================================

-- Enable RLS (idempotent)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Customers can view own waitlist" ON waitlist;
DROP POLICY IF EXISTS "Customers can manage own waitlist" ON waitlist;
DROP POLICY IF EXISTS "Staff can view salon waitlist" ON waitlist;
DROP POLICY IF EXISTS "Staff can update salon waitlist" ON waitlist;

-- Customers can view their own waitlist entries
CREATE POLICY "Customers can view own waitlist"
ON waitlist FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE profile_id = auth.uid()
  )
);

-- Customers can join/leave waitlist
CREATE POLICY "Customers can manage own waitlist"
ON waitlist FOR ALL
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE profile_id = auth.uid()
  )
);

-- Staff can view waitlist for their salon
CREATE POLICY "Staff can view salon waitlist"
ON waitlist FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Staff can update waitlist status
CREATE POLICY "Staff can update salon waitlist"
ON waitlist FOR UPDATE
TO authenticated
USING (
  salon_id IN (
    SELECT s.salon_id FROM staff s
    JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
    WHERE s.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager', 'mitarbeiter')
  )
);

-- ============================================
-- 2. HELPER FUNCTION: Expire waitlist entries
-- Run via cron job
-- ============================================

CREATE OR REPLACE FUNCTION expire_waitlist_entries()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE waitlist
    SET status = 'expired'
    WHERE status = 'active'
      AND preferred_date_to < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_waitlist_entries IS 'Expire waitlist entries past their preferred date range';

-- ============================================
-- 3. VIEW: Active waitlist with customer details
-- ============================================

CREATE OR REPLACE VIEW v_active_waitlist AS
SELECT
  w.*,
  c.first_name || ' ' || c.last_name AS customer_name,
  p.phone AS customer_phone,
  p.email AS customer_email,
  s.name AS preferred_service_name,
  COALESCE(st.display_name, 'Beliebig') AS preferred_staff_name
FROM waitlist w
JOIN customers c ON w.customer_id = c.id
JOIN profiles p ON c.profile_id = p.id
LEFT JOIN services s ON w.preferred_service_id = s.id
LEFT JOIN staff st ON w.preferred_staff_id = st.id
WHERE w.status = 'active';

COMMENT ON VIEW v_active_waitlist IS 'Active waitlist entries with customer details';

-- ============================================
-- 4. VIEW: Waitlist statistics
-- ============================================

CREATE OR REPLACE VIEW v_waitlist_stats AS
SELECT
  salon_id,
  COUNT(*) FILTER (WHERE status = 'active') AS active_count,
  COUNT(*) FILTER (WHERE status = 'notified') AS notified_count,
  COUNT(*) FILTER (WHERE status = 'converted') AS converted_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('converted', 'expired')), 0) * 100,
    1
  ) AS conversion_rate
FROM waitlist
GROUP BY salon_id;

COMMENT ON VIEW v_waitlist_stats IS 'Waitlist statistics per salon';

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE waitlist IS 'Customer waitlist for preferred time slots';
