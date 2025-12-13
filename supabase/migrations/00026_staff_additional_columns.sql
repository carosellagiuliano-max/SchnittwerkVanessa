-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00026_staff_additional_columns.sql
-- Description: Add missing columns to staff table for admin UI
-- ============================================

-- Add additional fields to staff table if not exists
DO $$
BEGIN
  -- Email (direct contact, separate from profile)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'email') THEN
    ALTER TABLE staff ADD COLUMN email TEXT;
  END IF;

  -- Phone (direct contact)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'phone') THEN
    ALTER TABLE staff ADD COLUMN phone TEXT;
  END IF;

  -- Color for calendar display
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'color') THEN
    ALTER TABLE staff ADD COLUMN color TEXT DEFAULT '#3b82f6';
  END IF;

  -- Role (admin, manager, staff)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'role') THEN
    ALTER TABLE staff ADD COLUMN role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'hq'));
  END IF;
END $$;

-- Comment on new columns
COMMENT ON COLUMN staff.email IS 'Direct staff email contact';
COMMENT ON COLUMN staff.phone IS 'Direct staff phone contact';
COMMENT ON COLUMN staff.color IS 'Color for calendar display';
COMMENT ON COLUMN staff.role IS 'Staff role: admin, manager, staff, hq';
