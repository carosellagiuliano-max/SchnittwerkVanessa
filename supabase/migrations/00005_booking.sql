-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00005_booking.sql
-- Description: Appointments, booking slots, waitlist
-- ============================================

-- ============================================
-- APPOINTMENTS TABLE
-- Core booking records
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Status
  status appointment_status NOT NULL DEFAULT 'reserved',

  -- Reservation tracking (for temporary holds)
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,

  -- Confirmation tracking
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES profiles(id),

  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),

  -- No-show tracking
  marked_no_show_at TIMESTAMPTZ,
  marked_no_show_by UUID REFERENCES profiles(id),

  -- Pricing (snapshot at booking time)
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,

  -- Customer notes (visible to customer)
  customer_notes TEXT,

  -- Internal notes (staff only)
  internal_notes TEXT,

  -- Source tracking
  booked_online BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_appointment_times CHECK (end_time > start_time),
  CONSTRAINT positive_duration CHECK (duration_minutes > 0)
);

COMMENT ON TABLE appointments IS 'Customer appointment bookings';
COMMENT ON COLUMN appointments.reserved_at IS 'When temporary reservation was created';
COMMENT ON COLUMN appointments.reservation_expires_at IS 'When reservation expires if not confirmed';
COMMENT ON COLUMN appointments.subtotal_cents IS 'Sum of all services before discounts';
COMMENT ON COLUMN appointments.booked_online IS 'Whether booked via online system or in-person';

-- Indexes for appointments
CREATE INDEX idx_appointments_salon ON appointments(salon_id);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_staff ON appointments(staff_id);
CREATE INDEX idx_appointments_status ON appointments(salon_id, status);
CREATE INDEX idx_appointments_date ON appointments(salon_id, start_time);
CREATE INDEX idx_appointments_staff_date ON appointments(staff_id, start_time);
CREATE INDEX idx_appointments_reservation_expiry ON appointments(reservation_expires_at)
  WHERE status = 'reserved';

-- Apply updated_at trigger
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- APPOINTMENT_SERVICES TABLE
-- Services included in an appointment (many-to-many)
-- ============================================
CREATE TABLE appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,

  -- Service details (snapshot at booking)
  service_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,

  -- Length variant if applicable
  length_variant_id UUID REFERENCES service_length_variants(id),
  length_variant_name TEXT,

  -- Display order
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE appointment_services IS 'Services booked within an appointment';
COMMENT ON COLUMN appointment_services.service_name IS 'Snapshot of service name at booking time';
COMMENT ON COLUMN appointment_services.price_cents IS 'Snapshot of price at booking time';

-- Indexes
CREATE INDEX idx_appt_services_appointment ON appointment_services(appointment_id);
CREATE INDEX idx_appt_services_service ON appointment_services(service_id);

-- ============================================
-- APPOINTMENT_ADDONS TABLE
-- Add-on services for appointments
-- ============================================
CREATE TABLE appointment_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  addon_service_id UUID NOT NULL REFERENCES addon_services(id) ON DELETE RESTRICT,

  -- Addon details (snapshot at booking)
  addon_name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  price_cents INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE appointment_addons IS 'Add-on services for appointments';

-- Indexes
CREATE INDEX idx_appt_addons_appointment ON appointment_addons(appointment_id);

-- ============================================
-- WAITLIST TABLE
-- Customers waiting for cancelled slots
-- ============================================
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Preferred settings
  preferred_staff_id UUID REFERENCES staff(id),
  preferred_service_id UUID REFERENCES services(id),

  -- Date range preferences
  preferred_date_from DATE NOT NULL,
  preferred_date_to DATE NOT NULL,

  -- Time preferences (stored as JSON for flexibility)
  -- Format: { "time_slots": ["morning", "afternoon", "evening"] }
  time_preferences JSONB DEFAULT '{"time_slots": ["morning", "afternoon"]}',

  -- Status
  status waitlist_status NOT NULL DEFAULT 'active',

  -- Notification tracking
  notified_at TIMESTAMPTZ,
  notified_count INTEGER DEFAULT 0,

  -- Conversion tracking
  converted_appointment_id UUID REFERENCES appointments(id),
  converted_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (preferred_date_to >= preferred_date_from)
);

COMMENT ON TABLE waitlist IS 'Customers waiting for available slots';
COMMENT ON COLUMN waitlist.time_preferences IS 'Preferred time slots as JSON';
COMMENT ON COLUMN waitlist.notified_count IS 'Number of times customer was notified';

-- Indexes
CREATE INDEX idx_waitlist_salon ON waitlist(salon_id);
CREATE INDEX idx_waitlist_customer ON waitlist(customer_id);
CREATE INDEX idx_waitlist_active ON waitlist(salon_id, status) WHERE status = 'active';
CREATE INDEX idx_waitlist_dates ON waitlist(preferred_date_from, preferred_date_to);

-- Apply updated_at trigger
CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BLOCKED_TIMES TABLE
-- Salon-wide blocked times (holidays, maintenance)
-- ============================================
CREATE TABLE blocked_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,

  -- Time range
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  -- Type and reason
  block_type blocked_time_type NOT NULL DEFAULT 'other',
  reason TEXT,

  -- Recurring (for annual holidays)
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  -- Constraints
  CONSTRAINT valid_blocked_times CHECK (end_time > start_time)
);

COMMENT ON TABLE blocked_times IS 'Salon-wide blocked time periods';
COMMENT ON COLUMN blocked_times.recurrence_rule IS 'RRULE for recurring blocks (e.g., annual holidays)';

-- Indexes
CREATE INDEX idx_blocked_times_salon ON blocked_times(salon_id);
CREATE INDEX idx_blocked_times_range ON blocked_times(salon_id, start_time, end_time);

-- ============================================
-- VIEW: Upcoming appointments
-- ============================================
CREATE VIEW v_upcoming_appointments AS
SELECT
  a.*,
  c.first_name AS customer_first_name,
  c.last_name AS customer_last_name,
  c.first_name || ' ' || c.last_name AS customer_name,
  s.display_name AS staff_name,
  (a.total_cents::DECIMAL / 100) AS total_chf
FROM appointments a
JOIN customers c ON a.customer_id = c.id
JOIN staff s ON a.staff_id = s.id
WHERE a.status IN ('confirmed', 'reserved', 'requested')
  AND a.start_time >= NOW();

COMMENT ON VIEW v_upcoming_appointments IS 'Future appointments with customer and staff info';

-- ============================================
-- VIEW: Today's appointments
-- ============================================
CREATE VIEW v_todays_appointments AS
SELECT
  a.*,
  c.first_name || ' ' || c.last_name AS customer_name,
  p.phone AS customer_phone,
  s.display_name AS staff_name
FROM appointments a
JOIN customers c ON a.customer_id = c.id
JOIN profiles p ON c.profile_id = p.id
JOIN staff s ON a.staff_id = s.id
WHERE DATE(a.start_time AT TIME ZONE 'Europe/Zurich') = CURRENT_DATE
  AND a.status IN ('confirmed', 'reserved')
ORDER BY a.start_time;

COMMENT ON VIEW v_todays_appointments IS 'Today''s scheduled appointments';

-- ============================================
-- FUNCTION: Check slot availability
-- ============================================
CREATE OR REPLACE FUNCTION is_slot_available(
  p_salon_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  conflict_count INTEGER;
  is_blocked BOOLEAN;
BEGIN
  -- Check for conflicting appointments
  SELECT COUNT(*) INTO conflict_count
  FROM appointments
  WHERE salon_id = p_salon_id
    AND staff_id = p_staff_id
    AND status IN ('reserved', 'requested', 'confirmed')
    AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time)
      OR (start_time < p_end_time AND end_time >= p_end_time)
      OR (start_time >= p_start_time AND end_time <= p_end_time)
    );

  IF conflict_count > 0 THEN
    RETURN false;
  END IF;

  -- Check for salon-wide blocked times
  SELECT EXISTS (
    SELECT 1 FROM blocked_times
    WHERE salon_id = p_salon_id
      AND (
        (start_time <= p_start_time AND end_time > p_start_time)
        OR (start_time < p_end_time AND end_time >= p_end_time)
        OR (start_time >= p_start_time AND end_time <= p_end_time)
      )
  ) INTO is_blocked;

  IF is_blocked THEN
    RETURN false;
  END IF;

  -- Check for staff schedule override (vacation, sick)
  SELECT EXISTS (
    SELECT 1 FROM staff_schedule_overrides
    WHERE staff_id = p_staff_id
      AND date = DATE(p_start_time AT TIME ZONE 'Europe/Zurich')
      AND custom_hours IS NULL  -- NULL means fully blocked
  ) INTO is_blocked;

  RETURN NOT is_blocked;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Get available slots for date
-- ============================================
CREATE OR REPLACE FUNCTION get_available_slots(
  p_salon_id UUID,
  p_staff_id UUID,
  p_date DATE,
  p_duration_minutes INTEGER,
  p_slot_granularity_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ
) AS $$
DECLARE
  staff_record RECORD;
  day_of_week TEXT;
  schedule_slots JSONB;
  slot_item JSONB;
  current_start TIME;
  current_end TIME;
  slot_time TIMESTAMPTZ;
  slot_end_time TIMESTAMPTZ;
BEGIN
  -- Get staff and their schedule
  SELECT * INTO staff_record FROM staff WHERE id = p_staff_id AND is_active = true;
  IF NOT FOUND OR NOT staff_record.is_bookable THEN
    RETURN;
  END IF;

  -- Get day of week
  day_of_week := LOWER(TO_CHAR(p_date, 'Dy'));

  -- Check for override first
  DECLARE
    override_record RECORD;
  BEGIN
    SELECT * INTO override_record
    FROM staff_schedule_overrides
    WHERE staff_id = p_staff_id AND date = p_date;

    IF FOUND THEN
      IF override_record.custom_hours IS NULL THEN
        -- Fully blocked
        RETURN;
      ELSE
        schedule_slots := override_record.custom_hours;
      END IF;
    ELSE
      -- Use default schedule
      IF NOT staff_record.default_schedule ? day_of_week THEN
        RETURN;
      END IF;
      schedule_slots := staff_record.default_schedule -> day_of_week;
    END IF;
  END;

  -- Iterate through schedule slots
  FOR slot_item IN SELECT * FROM jsonb_array_elements(schedule_slots)
  LOOP
    current_start := (slot_item->>'start')::TIME;
    current_end := (slot_item->>'end')::TIME;

    -- Generate slots at granularity intervals
    slot_time := (p_date + current_start) AT TIME ZONE 'Europe/Zurich';
    WHILE (slot_time + (p_duration_minutes || ' minutes')::INTERVAL) <=
          ((p_date + current_end) AT TIME ZONE 'Europe/Zurich')
    LOOP
      slot_end_time := slot_time + (p_duration_minutes || ' minutes')::INTERVAL;

      -- Check if slot is available
      IF is_slot_available(p_salon_id, p_staff_id, slot_time, slot_end_time) THEN
        slot_start := slot_time;
        slot_end := slot_end_time;
        RETURN NEXT;
      END IF;

      slot_time := slot_time + (p_slot_granularity_minutes || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Create reservation (temporary hold)
-- ============================================
CREATE OR REPLACE FUNCTION create_reservation(
  p_salon_id UUID,
  p_customer_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_timeout_minutes INTEGER DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
  new_appointment_id UUID;
  end_time TIMESTAMPTZ;
BEGIN
  end_time := p_start_time + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Check availability
  IF NOT is_slot_available(p_salon_id, p_staff_id, p_start_time, end_time) THEN
    RAISE EXCEPTION 'Slot is not available';
  END IF;

  -- Create reservation
  INSERT INTO appointments (
    salon_id, customer_id, staff_id,
    start_time, end_time, duration_minutes,
    status, reserved_at, reservation_expires_at
  ) VALUES (
    p_salon_id, p_customer_id, p_staff_id,
    p_start_time, end_time, p_duration_minutes,
    'reserved', NOW(), NOW() + (p_timeout_minutes || ' minutes')::INTERVAL
  )
  RETURNING id INTO new_appointment_id;

  RETURN new_appointment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Confirm appointment
-- ============================================
CREATE OR REPLACE FUNCTION confirm_appointment(
  p_appointment_id UUID,
  p_confirmed_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  appt_record RECORD;
BEGIN
  -- Get and lock appointment
  SELECT * INTO appt_record
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF appt_record.status NOT IN ('reserved', 'requested') THEN
    RAISE EXCEPTION 'Appointment cannot be confirmed from status %', appt_record.status;
  END IF;

  -- Update to confirmed
  UPDATE appointments
  SET
    status = 'confirmed',
    confirmed_at = NOW(),
    confirmed_by = p_confirmed_by,
    reservation_expires_at = NULL
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Cancel appointment
-- ============================================
CREATE OR REPLACE FUNCTION cancel_appointment(
  p_appointment_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  appt_record RECORD;
BEGIN
  -- Get and lock appointment
  SELECT * INTO appt_record
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF appt_record.status IN ('cancelled', 'completed', 'no_show') THEN
    RAISE EXCEPTION 'Appointment cannot be cancelled from status %', appt_record.status;
  END IF;

  -- Update to cancelled
  UPDATE appointments
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Cleanup expired reservations
-- (Should be called via cron job)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM appointments
    WHERE status = 'reserved'
      AND reservation_expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Active customers with computed fields
-- (Moved from 00003 due to appointments dependency)
-- ============================================
CREATE VIEW v_active_customers AS
SELECT
  c.*,
  c.first_name || ' ' || c.last_name AS full_name,
  p.email,
  p.phone AS profile_phone,
  (
    SELECT COUNT(*)
    FROM appointments a
    WHERE a.customer_id = c.id
    AND a.status = 'completed'
  ) AS total_appointments,
  (
    SELECT MAX(a.start_time)
    FROM appointments a
    WHERE a.customer_id = c.id
    AND a.status = 'completed'
  ) AS last_appointment_date
FROM customers c
JOIN profiles p ON c.profile_id = p.id
WHERE c.is_active = true;

COMMENT ON VIEW v_active_customers IS 'Active customers with computed statistics';
