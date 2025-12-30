'use server';

import { createServerClient } from '@/lib/db/client';
import { unstable_cache, revalidateTag } from 'next/cache';

// ============================================
// SALON DATA SERVER ACTIONS
// ============================================

// Default salon ID for SCHNITTWERK (from seed data)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

export type Salon = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  defaultVatRate: number;
  isActive: boolean;
};

export type OpeningHour = {
  dayOfWeek: number;
  dayName: string;
  openTime: string | null;
  closeTime: string | null;
  isOpen: boolean;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  services: Service[];
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  priceFrom: boolean;
  hasLengthVariants: boolean;
  isBookableOnline: boolean;
  sortOrder: number;
  lengthVariants?: ServiceLengthVariant[];
};

export type ServiceLengthVariant = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
};

export type AddonService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
};

// Day names in German
const DAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

// ============================================
// GET SALON
// ============================================

export const getSalon = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<Salon | null> => {
    const supabase = createServerClient();

    // Return null during build if Supabase is not available
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .eq('id', salonId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Error fetching salon:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      address: data.address,
      zipCode: data.zip_code,
      city: data.city,
      country: data.country,
      phone: data.phone,
      email: data.email,
      website: data.website,
      timezone: data.timezone,
      currency: data.currency,
      defaultVatRate: data.default_vat_rate,
      isActive: data.is_active,
    };
  },
  ['salon'],
  { revalidate: 3600, tags: ['salon'] }
);

// ============================================
// GET OPENING HOURS
// ============================================

export const getOpeningHours = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<OpeningHour[]> => {
    const supabase = createServerClient();

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('opening_hours')
      .select('*')
      .eq('salon_id', salonId)
      .order('day_of_week', { ascending: true });

    if (error || !data) {
      console.error('Error fetching opening hours:', error);
      return [];
    }

    return data.map((row) => ({
      dayOfWeek: row.day_of_week,
      dayName: DAY_NAMES[row.day_of_week],
      openTime: row.open_time,
      closeTime: row.close_time,
      isOpen: row.is_open,
    }));
  },
  ['opening-hours'],
  { revalidate: 3600, tags: ['opening-hours'] }
);

// ============================================
// GET SERVICES WITH CATEGORIES
// ============================================

export const getServicesWithCategories = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<ServiceCategory[]> => {
    const supabase = createServerClient();

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    // Get categories
    const { data: categories, error: catError } = await supabase
      .from('service_categories')
      .select('*')
      .eq('salon_id', salonId)
      .order('sort_order', { ascending: true });

    if (catError || !categories) {
      console.error('Error fetching categories:', catError);
      return [];
    }

    // Get services with length variants
    const { data: services, error: svcError } = await supabase
      .from('services')
      .select(`
        *,
        service_length_variants (*)
      `)
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (svcError || !services) {
      console.error('Error fetching services:', svcError);
      return [];
    }

    // Group services by category
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      sortOrder: cat.sort_order,
      services: services
        .filter((svc) => svc.category_id === cat.id)
        .map((svc) => ({
          id: svc.id,
          name: svc.name,
          slug: svc.slug,
          description: svc.description,
          durationMinutes: svc.duration_minutes,
          priceCents: svc.price_cents,
          priceFrom: svc.price_from || false,
          hasLengthVariants: svc.has_length_variants || false,
          isBookableOnline: svc.is_bookable_online,
          sortOrder: svc.sort_order,
          lengthVariants: svc.service_length_variants?.map((v: any) => ({
            id: v.id,
            name: v.name,
            description: v.description,
            durationMinutes: v.duration_minutes,
            priceCents: v.price_cents,
            sortOrder: v.sort_order,
          })) || [],
        })),
    }));
  },
  ['services-with-categories'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET BOOKABLE SERVICES (for booking flow)
// ============================================

export const getBookableServices = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<ServiceCategory[]> => {
    const allServices = await getServicesWithCategories(salonId);

    // Filter to only bookable online services
    return allServices
      .map((cat) => ({
        ...cat,
        services: cat.services.filter((svc) => svc.isBookableOnline),
      }))
      .filter((cat) => cat.services.length > 0);
  },
  ['bookable-services'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET ADDON SERVICES
// ============================================

export const getAddonServices = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<AddonService[]> => {
    const supabase = createServerClient();

    // Return empty array during build if Supabase is not available
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('addon_services')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      console.error('Error fetching addon services:', error);
      return [];
    }

    return data.map((addon) => ({
      id: addon.id,
      name: addon.name,
      description: addon.description,
      durationMinutes: addon.duration_minutes,
      priceCents: addon.price_cents,
      sortOrder: addon.sort_order,
    }));
  },
  ['addon-services'],
  { revalidate: 3600, tags: ['services'] }
);

// ============================================
// GET ALL PUBLIC SALON DATA (combined)
// ============================================

export async function getPublicSalonData(salonId: string = DEFAULT_SALON_ID) {
  const [salon, openingHours, services, addons] = await Promise.all([
    getSalon(salonId),
    getOpeningHours(salonId),
    getServicesWithCategories(salonId),
    getAddonServices(salonId),
  ]);

  return {
    salon,
    openingHours,
    services,
    addons,
  };
}

// ============================================
// UPDATE OPENING HOURS
// ============================================

export type UpdateOpeningHoursInput = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}[];

export type UpdateOpeningHoursResult = {
  success: boolean;
  error?: string;
};

export async function updateOpeningHours(
  openingHours: UpdateOpeningHoursInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<UpdateOpeningHoursResult> {
  const supabase = createServerClient();

  if (!supabase) {
    return { success: false, error: 'Database connection not available' };
  }

  try {
    // Update each day's opening hours using upsert
    for (const hours of openingHours) {
      const { error } = await supabase
        .from('opening_hours')
        .upsert(
          {
            salon_id: salonId,
            day_of_week: hours.dayOfWeek,
            open_time: hours.openTime,
            close_time: hours.closeTime,
            is_open: hours.isOpen,
          },
          {
            onConflict: 'salon_id,day_of_week',
          }
        );

      if (error) {
        console.error('Error updating opening hours:', error);
        return {
          success: false,
          error: `Fehler beim Speichern: ${error.message}`,
        };
      }
    }

    // Revalidate caches
    revalidateTag('opening-hours');
    revalidateTag('booking');

    return { success: true };
  } catch (error) {
    console.error('Error updating opening hours:', error);
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}
