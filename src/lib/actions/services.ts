'use server';

import { createServerClient } from '@/lib/db/client';
import { revalidateTag } from 'next/cache';

// ============================================
// SERVICE MANAGEMENT SERVER ACTIONS
// ============================================

// Default salon ID for SCHNITTWERK (from seed data)
const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// TYPES
// ============================================

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export type ServiceForAdmin = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  durationMinutes: number;
  priceCents: number;
  priceFrom: boolean;
  hasLengthVariants: boolean;
  isBookableOnline: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type CreateServiceInput = {
  name: string;
  description?: string;
  categoryId?: string;
  durationMinutes: number;
  priceCents: number;
  priceFrom?: boolean;
  isBookableOnline?: boolean;
};

export type UpdateServiceInput = {
  id: string;
  name?: string;
  description?: string;
  categoryId?: string;
  durationMinutes?: number;
  priceCents?: number;
  priceFrom?: boolean;
  isBookableOnline?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// GET SERVICE CATEGORIES (for dropdown)
// ============================================

export async function getServiceCategories(
  salonId: string = DEFAULT_SALON_ID
): Promise<ServiceCategory[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('service_categories') as any)
    .select('id, name, slug, description, sort_order')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching service categories:', error);
    return [];
  }

  return data.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sort_order,
  }));
}

// ============================================
// GET ALL SERVICES FOR ADMIN (including inactive)
// ============================================

export async function getAllServicesForAdmin(
  salonId: string = DEFAULT_SALON_ID
): Promise<ServiceForAdmin[]> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
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
        name
      )
    `)
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    console.error('Error fetching services for admin:', error);
    return [];
  }

  return data.map((svc: any) => ({
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
}

// ============================================
// CREATE SERVICE
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (match) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[match] || match;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createService(
  input: CreateServiceInput,
  salonId: string = DEFAULT_SALON_ID
): Promise<ServiceResult<ServiceForAdmin>> {
  const supabase = createServerClient();

  const slug = generateSlug(input.name);

  // Get max sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxSort } = await (supabase
    .from('services') as any)
    .select('sort_order')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (maxSort?.sort_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
    .insert({
      salon_id: salonId,
      name: input.name,
      slug: slug,
      description: input.description || null,
      category_id: input.categoryId || null,
      duration_minutes: input.durationMinutes,
      price_cents: input.priceCents,
      price_from: input.priceFrom || false,
      is_bookable_online: input.isBookableOnline !== false,
      is_active: true,
      sort_order: nextSortOrder,
    })
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
        name
      )
    `)
    .single();

  if (error) {
    console.error('Error creating service:', error);
    return { success: false, error: 'Fehler beim Erstellen der Leistung' };
  }

  // Revalidate cache directly
  revalidateTag('services', 'max');

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      categoryId: data.category_id,
      categoryName: data.service_categories?.name || null,
      durationMinutes: data.duration_minutes,
      priceCents: data.price_cents,
      priceFrom: data.price_from || false,
      hasLengthVariants: data.has_length_variants || false,
      isBookableOnline: data.is_bookable_online,
      isActive: data.is_active,
      sortOrder: data.sort_order,
    },
  };
}

// ============================================
// UPDATE SERVICE
// ============================================

export async function updateService(
  input: UpdateServiceInput
): Promise<ServiceResult<ServiceForAdmin>> {
  const supabase = createServerClient();

  const updateData: Record<string, any> = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
    updateData.slug = generateSlug(input.name);
  }
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
  if (input.durationMinutes !== undefined) updateData.duration_minutes = input.durationMinutes;
  if (input.priceCents !== undefined) updateData.price_cents = input.priceCents;
  if (input.priceFrom !== undefined) updateData.price_from = input.priceFrom;
  if (input.isBookableOnline !== undefined) updateData.is_bookable_online = input.isBookableOnline;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('services') as any)
    .update(updateData)
    .eq('id', input.id)
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
        name
      )
    `)
    .single();

  if (error) {
    console.error('Error updating service:', error);
    return { success: false, error: 'Fehler beim Aktualisieren der Leistung' };
  }

  // Revalidate cache directly
  revalidateTag('services', 'max');

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      categoryId: data.category_id,
      categoryName: data.service_categories?.name || null,
      durationMinutes: data.duration_minutes,
      priceCents: data.price_cents,
      priceFrom: data.price_from || false,
      hasLengthVariants: data.has_length_variants || false,
      isBookableOnline: data.is_bookable_online,
      isActive: data.is_active,
      sortOrder: data.sort_order,
    },
  };
}

// ============================================
// DELETE SERVICE (soft delete)
// ============================================

export async function deleteService(
  serviceId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('services') as any)
    .update({ is_active: false })
    .eq('id', serviceId);

  if (error) {
    console.error('Error deleting service:', error);
    return { success: false, error: 'Fehler beim Löschen der Leistung' };
  }

  // Revalidate cache directly
  revalidateTag('services', 'max');

  return { success: true, data: true };
}

// ============================================
// RESTORE SERVICE (undo soft delete)
// ============================================

export async function restoreService(
  serviceId: string
): Promise<ServiceResult<boolean>> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase
    .from('services') as any)
    .update({ is_active: true })
    .eq('id', serviceId);

  if (error) {
    console.error('Error restoring service:', error);
    return { success: false, error: 'Fehler beim Wiederherstellen der Leistung' };
  }

  // Revalidate cache directly
  revalidateTag('services', 'max');

  return { success: true, data: true };
}
