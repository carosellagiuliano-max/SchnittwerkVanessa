import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { AdminSettingsView } from '@/components/admin/admin-settings-view';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Einstellungen',
};

// ============================================
// DATA FETCHING
// ============================================

async function getSettingsData() {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('Supabase client not available');
    return {
      salon: null,
      services: [],
      categories: [],
      openingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: '09:00',
        closeTime: '18:00',
        isOpen: dayOfWeek !== 0,
      })),
    };
  }

  // Get salon settings
  const { data: salonData } = await supabase
    .from('salons')
    .select('*')
    .single();

  // Get opening hours
  const { data: openingHoursData } = await supabase
    .from('opening_hours')
    .select('day_of_week, open_time, close_time, is_open')
    .eq('salon_id', salonData?.id || '550e8400-e29b-41d4-a716-446655440001')
    .order('day_of_week');

  // Get services with category info
  const { data: servicesData } = await supabase
    .from('services')
    .select(`
      id,
      name,
      slug,
      description,
      category_id,
      duration_minutes,
      price_cents,
      price_from,
      has_length_variants,
      is_bookable_online,
      is_active,
      sort_order,
      service_categories (
        id,
        name
      )
    `)
    .order('sort_order', { ascending: true });

  // Get categories for dropdown
  const { data: categoriesData } = await supabase
    .from('service_categories')
    .select('id, name, slug, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Transform services data
  const services = (servicesData || []).map((svc: any) => ({
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    categoryId: svc.category_id,
    categoryName: svc.service_categories?.name || null,
    durationMinutes: svc.duration_minutes,
    priceCents: svc.price_cents,
    priceFrom: svc.price_from || false,
    hasLengthVariants: svc.has_length_variants || false,
    isBookableOnline: svc.is_bookable_online,
    isActive: svc.is_active,
    sortOrder: svc.sort_order,
  }));

  // Transform categories data
  const categories = (categoriesData || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sort_order,
  }));

  // Transform opening hours - create default if not found
  const openingHours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const found = openingHoursData?.find((oh: any) => oh.day_of_week === dayOfWeek);
    return {
      dayOfWeek,
      openTime: found?.open_time?.substring(0, 5) || '09:00',
      closeTime: found?.close_time?.substring(0, 5) || '18:00',
      isOpen: found?.is_open ?? (dayOfWeek !== 0), // Sunday closed by default
    };
  });

  return {
    salon: salonData,
    services,
    categories,
    openingHours,
  };
}

// ============================================
// ADMIN SETTINGS PAGE
// ============================================

export default async function AdminSettingsPage() {
  const { salon, services, categories, openingHours } = await getSettingsData();

  return <AdminSettingsView salon={salon} services={services} categories={categories} openingHours={openingHours} />;
}
