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

  return {
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
  const { staff, services } = await getCalendarData();

  return <AdminFullCalendar staff={staff} services={services} />;
}
