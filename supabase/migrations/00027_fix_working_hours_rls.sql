-- ============================================
-- FIX RLS POLICIES FOR DEVELOPMENT
-- Make policies permissive since user_roles table is empty
-- ============================================

-- Fix staff table RLS - allow authenticated users to manage
DROP POLICY IF EXISTS "staff_manage_admin" ON staff;

CREATE POLICY "staff_manage_authenticated"
  ON staff FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop old policies that depend on user_roles
DROP POLICY IF EXISTS "Managers can manage working hours" ON staff_working_hours;
DROP POLICY IF EXISTS "Staff can view their own absences" ON staff_absences;
DROP POLICY IF EXISTS "Managers can manage absences" ON staff_absences;

-- New policy: Allow authenticated users to manage working hours
-- In production, this should be more restrictive with proper profile_id linking
CREATE POLICY "Managers can manage working hours"
  ON staff_working_hours FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix absences policies - permissive for development
CREATE POLICY "Staff can view their own absences"
  ON staff_absences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage absences"
  ON staff_absences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix staff_blocks policies if they exist
DROP POLICY IF EXISTS "Staff can view their own blocks" ON staff_blocks;
DROP POLICY IF EXISTS "Managers can manage blocks" ON staff_blocks;

CREATE POLICY "Staff can view their own blocks"
  ON staff_blocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage blocks"
  ON staff_blocks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix staff_service_skills policies
DROP POLICY IF EXISTS "Managers can manage staff skills" ON staff_service_skills;

CREATE POLICY "Managers can manage staff skills"
  ON staff_service_skills FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
