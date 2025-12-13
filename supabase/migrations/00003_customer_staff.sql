-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00003_customer_staff.sql
-- Description: Customer and Staff tables
-- ============================================

-- ============================================
-- CUSTOMERS TABLE
-- Salon-specific customer records
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Personal Info (denormalized for salon-specific data)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthday DATE,

  -- Contact preferences (can differ from profile)
  preferred_contact TEXT DEFAULT 'email',

  -- Customer notes (internal, only staff can see)
  notes TEXT,
  hair_notes TEXT,

  -- Marketing preferences
  accepts_marketing BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_customer_per_salon UNIQUE (salon_id, profile_id)
);

COMMENT ON TABLE customers IS 'Salon-specific customer records';
COMMENT ON COLUMN customers.profile_id IS 'Links to profiles table (auth user)';
COMMENT ON COLUMN customers.notes IS 'Internal notes visible only to staff';
COMMENT ON COLUMN customers.hair_notes IS 'Hair-specific notes (color history, preferences)';
COMMENT ON COLUMN customers.last_visit_at IS 'Updated after each completed appointment';

-- Indexes for customers
CREATE INDEX idx_customers_salon ON customers(salon_id);
CREATE INDEX idx_customers_profile ON customers(profile_id);
CREATE INDEX idx_customers_name ON customers(salon_id, last_name, first_name);
CREATE INDEX idx_customers_last_visit ON customers(salon_id, last_visit_at);

-- Apply updated_at trigger
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STAFF TABLE
-- Staff members per salon
-- ============================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Staff Info
  display_name TEXT NOT NULL,
  job_title TEXT,
  bio TEXT,
  avatar_url TEXT,
  specialties TEXT[],

  -- Booking settings
  is_bookable BOOLEAN NOT NULL DEFAULT true,
  booking_lead_time_minutes INTEGER DEFAULT 60,
  max_daily_appointments INTEGER,

  -- Work schedule (JSON for flexibility)
  -- Format: { "mon": [{"start": "09:00", "end": "18:00"}], ... }
  default_schedule JSONB DEFAULT '{}',

  -- Display order (for UI sorting)
  sort_order INTEGER DEFAULT 0,

  -- Commission settings
  commission_rate DECIMAL(5,2),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_staff_per_salon UNIQUE (salon_id, profile_id)
);

COMMENT ON TABLE staff IS 'Staff members who can be booked';
COMMENT ON COLUMN staff.display_name IS 'Name shown to customers';
COMMENT ON COLUMN staff.is_bookable IS 'Whether staff accepts online bookings';
COMMENT ON COLUMN staff.default_schedule IS 'Default weekly schedule as JSON';
COMMENT ON COLUMN staff.commission_rate IS 'Percentage for commission tracking';

-- Indexes for staff
CREATE INDEX idx_staff_salon ON staff(salon_id);
CREATE INDEX idx_staff_profile ON staff(profile_id);
CREATE INDEX idx_staff_bookable ON staff(salon_id, is_bookable) WHERE is_active = true;

-- Apply updated_at trigger
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STAFF_SCHEDULE_OVERRIDES TABLE
-- Daily schedule overrides (vacations, special days)
-- ============================================
CREATE TABLE staff_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Date range
  date DATE NOT NULL,

  -- Override type
  override_type blocked_time_type NOT NULL DEFAULT 'other',

  -- If not fully blocked, custom hours
  -- NULL means fully blocked, otherwise custom hours
  custom_hours JSONB,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_staff_date_override UNIQUE (staff_id, date)
);

COMMENT ON TABLE staff_schedule_overrides IS 'Daily schedule exceptions for staff';
COMMENT ON COLUMN staff_schedule_overrides.custom_hours IS 'Custom hours if partially available, NULL if fully blocked';

-- Indexes
CREATE INDEX idx_staff_overrides_staff ON staff_schedule_overrides(staff_id);
CREATE INDEX idx_staff_overrides_date ON staff_schedule_overrides(date);
CREATE INDEX idx_staff_overrides_range ON staff_schedule_overrides(staff_id, date);

-- ============================================
-- HELPER FUNCTION: Get customer full name
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_full_name(customer_id UUID)
RETURNS TEXT AS $$
  SELECT first_name || ' ' || last_name
  FROM customers
  WHERE id = customer_id;
$$ LANGUAGE sql STABLE;

-- ============================================
-- HELPER FUNCTION: Get staff display name
-- ============================================
CREATE OR REPLACE FUNCTION get_staff_display_name(staff_member_id UUID)
RETURNS TEXT AS $$
  SELECT display_name
  FROM staff
  WHERE id = staff_member_id;
$$ LANGUAGE sql STABLE;

-- ============================================
-- HELPER FUNCTION: Check if staff is available on date
-- ============================================
CREATE OR REPLACE FUNCTION is_staff_available_on_date(staff_member_id UUID, check_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  staff_record RECORD;
  override_record RECORD;
  day_of_week TEXT;
BEGIN
  -- Get staff record
  SELECT * INTO staff_record FROM staff WHERE id = staff_member_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if not bookable
  IF NOT staff_record.is_bookable THEN
    RETURN false;
  END IF;

  -- Check for override (vacation, sick, etc.)
  SELECT * INTO override_record
  FROM staff_schedule_overrides
  WHERE staff_id = staff_member_id AND date = check_date;

  IF FOUND AND override_record.custom_hours IS NULL THEN
    -- Fully blocked
    RETURN false;
  END IF;

  -- Check default schedule for day of week
  day_of_week := LOWER(TO_CHAR(check_date, 'Dy'));

  IF staff_record.default_schedule ? day_of_week THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- VIEW: Active bookable staff
-- (Note: v_active_customers moved to 00005 due to appointments dependency)
-- ============================================
CREATE VIEW v_bookable_staff AS
SELECT
  s.*,
  p.email,
  p.phone AS profile_phone
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true AND s.is_bookable = true;

COMMENT ON VIEW v_bookable_staff IS 'Staff members available for booking';
