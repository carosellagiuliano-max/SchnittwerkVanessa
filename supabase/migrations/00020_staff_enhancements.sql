-- ============================================
-- STAFF BLOCKS TABLE
-- Time blocks where staff are unavailable
-- ============================================

CREATE TABLE IF NOT EXISTS staff_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT DEFAULT 'Blockiert',
  is_all_day BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB, -- For recurring blocks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_block_time CHECK (end_time > start_time)
);

-- Index for querying blocks by staff and time
CREATE INDEX IF NOT EXISTS idx_staff_blocks_staff_time
  ON staff_blocks(staff_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_staff_blocks_salon
  ON staff_blocks(salon_id);

-- ============================================
-- STAFF SKILLS TABLE
-- Track which services each staff member can perform
-- ============================================

CREATE TABLE IF NOT EXISTS staff_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  proficiency_level TEXT DEFAULT 'standard' CHECK (proficiency_level IN ('beginner', 'standard', 'expert')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_skills_staff ON staff_skills(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_skills_service ON staff_skills(service_id);

-- ============================================
-- STAFF WORKING HOURS TABLE
-- Regular weekly working hours for staff
-- ============================================

CREATE TABLE IF NOT EXISTS staff_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week),
  CONSTRAINT valid_working_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_staff_working_hours_staff ON staff_working_hours(staff_id);

-- ============================================
-- STAFF ABSENCES TABLE
-- Planned absences (vacation, sick leave, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS staff_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  absence_type TEXT NOT NULL DEFAULT 'vacation' CHECK (absence_type IN ('vacation', 'sick', 'personal', 'training', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_absence_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_absences_staff ON staff_absences(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_absences_dates ON staff_absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_staff_absences_salon ON staff_absences(salon_id);

-- ============================================
-- ADD FIELDS TO STAFF TABLE
-- ============================================

-- Add additional fields to staff table if not exists
DO $$
BEGIN
  -- Employment type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'employment_type') THEN
    ALTER TABLE staff ADD COLUMN employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'apprentice'));
  END IF;

  -- Hire date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'hire_date') THEN
    ALTER TABLE staff ADD COLUMN hire_date DATE;
  END IF;

  -- Termination date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'termination_date') THEN
    ALTER TABLE staff ADD COLUMN termination_date DATE;
  END IF;

  -- Bio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'bio') THEN
    ALTER TABLE staff ADD COLUMN bio TEXT;
  END IF;

  -- Specializations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'specializations') THEN
    ALTER TABLE staff ADD COLUMN specializations TEXT[];
  END IF;
END $$;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE staff_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_absences ENABLE ROW LEVEL SECURITY;

-- Staff blocks policies
CREATE POLICY "Staff can view their own blocks"
  ON staff_blocks FOR SELECT
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff s
      JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
      WHERE s.profile_id = auth.uid()
      AND s.salon_id = staff_blocks.salon_id
      AND ur.role_name IN ('admin', 'manager', 'hq')
    )
  );

CREATE POLICY "Managers can manage blocks"
  ON staff_blocks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
      WHERE s.profile_id = auth.uid()
      AND s.salon_id = staff_blocks.salon_id
      AND ur.role_name IN ('admin', 'manager', 'hq')
    )
  );

-- Staff skills policies
CREATE POLICY "Anyone can view staff skills"
  ON staff_skills FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage skills"
  ON staff_skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s1
      JOIN staff s2 ON s1.salon_id = s2.salon_id
      JOIN user_roles ur ON ur.profile_id = s1.profile_id AND ur.salon_id = s1.salon_id
      WHERE s1.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'hq')
      AND s2.id = staff_skills.staff_id
    )
  );

-- Working hours policies
CREATE POLICY "Anyone can view working hours"
  ON staff_working_hours FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage working hours"
  ON staff_working_hours FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s1
      JOIN staff s2 ON s1.salon_id = s2.salon_id
      JOIN user_roles ur ON ur.profile_id = s1.profile_id AND ur.salon_id = s1.salon_id
      WHERE s1.profile_id = auth.uid()
      AND ur.role_name IN ('admin', 'manager', 'hq')
      AND s2.id = staff_working_hours.staff_id
    )
  );

-- Absences policies
CREATE POLICY "Staff can view their own absences"
  ON staff_absences FOR SELECT
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff s
      JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
      WHERE s.profile_id = auth.uid()
      AND s.salon_id = staff_absences.salon_id
      AND ur.role_name IN ('admin', 'manager', 'hq')
    )
  );

CREATE POLICY "Staff can request absences"
  ON staff_absences FOR INSERT
  TO authenticated
  WITH CHECK (
    staff_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
  );

CREATE POLICY "Managers can manage absences"
  ON staff_absences FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
      WHERE s.profile_id = auth.uid()
      AND s.salon_id = staff_absences.salon_id
      AND ur.role_name IN ('admin', 'manager', 'hq')
    )
  );
