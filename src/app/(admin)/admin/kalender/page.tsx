import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { AdminFullCalendar } from '@/components/admin/admin-fullcalendar';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kalender',
};

// ============================================
// DATA FETCHING
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

async function getCalendarData() {
  const supabase = await createServerClient();

  // Get all staff members
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, display_name, color, is_active, salon_id')
    .eq('is_active', true)
    .order('display_name');

  // Get all services
  const { data: servicesData } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents, is_active')
    .eq('is_active', true)
    .order('name');

  // Get salonId from first staff member or use default
  const salonId = staffData?.[0]?.salon_id || DEFAULT_SALON_ID;

  return {
    salonId,
    staff: (staffData || []) as Array<{
      id: string;
      display_name: string;
      color: string | null;
      is_active: boolean;
      salon_id: string;
    }>,
    services: (servicesData || []) as Array<{
      id: string;
      name: string;
      duration_minutes: number;
      price_cents: number;
      is_active: boolean;
    }>,
  };
}

// ============================================
// ADMIN CALENDAR PAGE
// ============================================

export default async function AdminCalendarPage() {
  const { salonId, staff, services } = await getCalendarData();

  return <AdminFullCalendar salonId={salonId} staff={staff} services={services} />;
}
