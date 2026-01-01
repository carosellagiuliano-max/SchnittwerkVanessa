'use server';

import { createServerClient } from '@/lib/db/client';
import { unstable_cache } from 'next/cache';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { headers } from 'next/headers';
import type {
  BookableService,
  BookableStaff,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
  BookingRequest,
  BookingConfirmation,
} from '@/lib/domain/booking/types';

// ============================================
// BOOKING SERVER ACTIONS
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// GET BOOKABLE DATA (All data needed for booking flow)
// ============================================

export interface BookingPageData {
  salonId: string;
  salonAddress: string;
  services: BookableService[];
  categories: { id: string; name: string }[];
  staff: BookableStaff[];
  openingHours: DayOpeningHours[];
  staffWorkingHours: StaffWorkingHours[];
  bookingRules: BookingRules;
}

export const getBookingPageData = unstable_cache(
  async (salonId: string = DEFAULT_SALON_ID): Promise<BookingPageData | null> => {
    const supabase = createServerClient();

    if (!supabase) {
      console.error('getBookingPageData: Supabase client not available');
      return null;
    }

    // Fetch salon
    const { data: salon } = await supabase
      .from('salons')
      .select('id, address, zip_code, city')
      .eq('id', salonId)
      .single();

    if (!salon) return null;

    // Fetch all data in parallel
    const [
      { data: categories },
      { data: services },
      { data: staff },
      { data: staffSkills },
      { data: openingHours },
      { data: staffWorkingHours },
      { data: bookingRules },
    ] = await Promise.all([
      // Categories
      supabase
        .from('service_categories')
        .select('id, name')
        .eq('salon_id', salonId)
        .order('sort_order'),

      // Services (bookable online)
      supabase
        .from('services')
        .select(`
          id, name, description, duration_minutes, price_cents,
          category_id, is_active
        `)
        .eq('salon_id', salonId)
        .eq('is_bookable_online', true)
        .eq('is_active', true)
        .order('sort_order'),

      // Staff
      supabase
        .from('staff')
        .select('id, display_name, avatar_url, is_bookable')
        .eq('salon_id', salonId)
        .eq('is_bookable', true)
        .eq('is_active', true)
        .order('sort_order'),

      // Staff skills - join via staff table since skills doesn't have salon_id
      supabase
        .from('staff_service_skills')
        .select(`
          staff_id,
          service_id,
          staff!inner(salon_id)
        `)
        .eq('staff.salon_id', salonId),

      // Opening hours
      supabase
        .from('opening_hours')
        .select('day_of_week, open_time, close_time, is_open')
        .eq('salon_id', salonId)
        .order('day_of_week'),

      // Staff working hours - join via staff table since working_hours doesn't have salon_id
      supabase
        .from('staff_working_hours')
        .select(`
          staff_id,
          day_of_week,
          start_time,
          end_time,
          staff!inner(salon_id)
        `)
        .eq('staff.salon_id', salonId)
        .eq('is_active', true),

      // Booking rules
      supabase
        .from('booking_rules')
        .select('*')
        .eq('salon_id', salonId)
        .single(),
    ]);

    // Build staff skills map
    const skillsMap = new Map<string, string[]>();
    staffSkills?.forEach((skill) => {
      const existing = skillsMap.get(skill.staff_id) || [];
      existing.push(skill.service_id);
      skillsMap.set(skill.staff_id, existing);
    });

    // Build category name map
    const categoryMap = new Map(categories?.map((c) => [c.id, c.name]) || []);

    // Transform data
    const bookableServices: BookableService[] = (services || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || undefined,
      durationMinutes: s.duration_minutes,
      currentPrice: s.price_cents,
      categoryId: s.category_id,
      categoryName: categoryMap.get(s.category_id) || undefined,
      isActive: s.is_active,
    }));

    const bookableStaff: BookableStaff[] = (staff || []).map((s) => ({
      id: s.id,
      name: s.display_name,
      imageUrl: s.avatar_url || undefined,
      serviceIds: skillsMap.get(s.id) || [],
      isBookable: s.is_bookable,
    }));

    const dayOpeningHours: DayOpeningHours[] = (openingHours || []).map((h) => ({
      dayOfWeek: h.day_of_week,
      openTime: h.open_time?.substring(0, 5) || '09:00',
      closeTime: h.close_time?.substring(0, 5) || '18:00',
      isClosed: !h.is_open,
    }));

    const staffHours: StaffWorkingHours[] = (staffWorkingHours || []).map((h) => ({
      staffId: h.staff_id,
      dayOfWeek: h.day_of_week,
      startTime: h.start_time?.substring(0, 5) || '09:00',
      endTime: h.end_time?.substring(0, 5) || '18:00',
    }));

    const rules: BookingRules = bookingRules
      ? {
          slotGranularityMinutes: bookingRules.slot_granularity_minutes || 15,
          leadTimeMinutes: bookingRules.min_lead_time_minutes || 60,
          horizonDays: bookingRules.max_booking_horizon_days || 90,
          bufferBetweenMinutes: bookingRules.buffer_between_minutes || 0,
          allowMultipleServices: true,
          requireDeposit: bookingRules.require_deposit || false,
          depositAmountCents: bookingRules.deposit_percent
            ? undefined
            : undefined,
          cancellationDeadlineHours: bookingRules.cancellation_cutoff_hours || 24,
        }
      : {
          slotGranularityMinutes: 15,
          leadTimeMinutes: 60,
          horizonDays: 90,
          bufferBetweenMinutes: 0,
          allowMultipleServices: true,
          requireDeposit: false,
          cancellationDeadlineHours: 24,
        };

    return {
      salonId: salon.id,
      salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
      services: bookableServices,
      categories: categories || [],
      staff: bookableStaff,
      openingHours: dayOpeningHours,
      staffWorkingHours: staffHours,
      bookingRules: rules,
    };
  },
  ['booking-page-data'],
  { revalidate: 300, tags: ['booking'] } // 5 min cache
);

// ============================================
// GET EXISTING APPOINTMENTS (for slot calculation)
// ============================================

export async function getExistingAppointments(
  salonId: string,
  startDate: string,
  endDate: string
): Promise<ExistingAppointment[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, staff_id, starts_at, ends_at, status')
    .eq('salon_id', salonId)
    .in('status', ['reserved', 'confirmed', 'requested'])
    .gte('starts_at', startDate)
    .lte('ends_at', endDate);

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    staffId: a.staff_id,
    startsAt: new Date(a.starts_at),
    endsAt: new Date(a.ends_at),
    status: a.status,
  }));
}

// ============================================
// GET STAFF ABSENCES
// ============================================

export async function getStaffAbsencesForDateRange(
  salonId: string,
  startDate: string,
  endDate: string
): Promise<StaffAbsence[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('staff_absences')
    .select('staff_id, start_date, end_date, reason')
    .eq('salon_id', salonId)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (error) {
    console.error('Error fetching staff absences:', error);
    return [];
  }

  return (data || []).map((a) => ({
    staffId: a.staff_id,
    startsAt: new Date(a.start_date),
    endsAt: new Date(a.end_date),
    reason: a.reason || undefined,
  }));
}

// ============================================
// GET BLOCKED TIMES (from staff_blocks table)
// ============================================

export async function getBlockedTimes(
  salonId: string,
  startDate: string,
  endDate: string
): Promise<BlockedTime[]> {
  const supabase = createServerClient();

  // Query staff_blocks table for staff-specific blocked times
  const { data: staffBlocks, error: staffBlocksError } = await supabase
    .from('staff_blocks')
    .select('staff_id, start_time, end_time, reason')
    .eq('salon_id', salonId)
    .lte('start_time', endDate)
    .gte('end_time', startDate);

  if (staffBlocksError) {
    console.error('Error fetching staff blocks:', staffBlocksError);
  }

  // Also query salon-wide blocked_times
  const { data: salonBlocks, error: salonBlocksError } = await supabase
    .from('blocked_times')
    .select('start_time, end_time, reason')
    .eq('salon_id', salonId)
    .lte('start_time', endDate)
    .gte('end_time', startDate);

  if (salonBlocksError) {
    console.error('Error fetching salon blocked times:', salonBlocksError);
  }

  // Combine both types of blocks
  const results: BlockedTime[] = [];

  // Add staff-specific blocks
  if (staffBlocks) {
    for (const b of staffBlocks) {
      results.push({
        staffId: b.staff_id,
        startsAt: new Date(b.start_time),
        endsAt: new Date(b.end_time),
        reason: b.reason || undefined,
      });
    }
  }

  // Add salon-wide blocks (apply to all staff - staffId null means all)
  if (salonBlocks) {
    for (const b of salonBlocks) {
      results.push({
        staffId: null, // null means applies to all staff
        startsAt: new Date(b.start_time),
        endsAt: new Date(b.end_time),
        reason: b.reason || undefined,
      });
    }
  }

  return results;
}

// ============================================
// CREATE APPOINTMENT RESERVATION
// ============================================

export type CreateReservationResult = {
  success: boolean;
  appointmentId?: string;
  error?: string;
  errorCode?: 'SLOT_ALREADY_TAKEN' | 'VALIDATION_ERROR' | 'SERVER_ERROR';
};

export async function createAppointmentReservation(
  request: BookingRequest,
  idempotencyKey?: string
): Promise<CreateReservationResult> {
  const supabase = createServerClient();

  try {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const { data: existingKey } = await supabase
        .from('idempotency_keys')
        .select('result, entity_id')
        .eq('key', idempotencyKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingKey?.result) {
        // Return cached result
        return existingKey.result as CreateReservationResult;
      }

      // Create idempotency key entry
      await supabase.from('idempotency_keys').upsert({
        key: idempotencyKey,
        operation: 'create_reservation',
        entity_type: 'appointment',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'key' });
    }

    // Calculate end time based on services
    const { data: services } = await supabase
      .from('services')
      .select('id, duration_minutes, price_cents, name')
      .in('id', request.serviceIds);

    if (!services || services.length === 0) {
      const result: CreateReservationResult = {
        success: false,
        error: 'Ungültige Services ausgewählt.',
        errorCode: 'VALIDATION_ERROR',
      };
      return result;
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price_cents, 0);
    const endsAt = new Date(request.startsAt.getTime() + totalDuration * 60 * 1000);

    // Check slot is still available (race condition protection)
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('salon_id', request.salonId)
      .eq('staff_id', request.staffId)
      .in('status', ['reserved', 'confirmed', 'requested'])
      .lt('start_time', endsAt.toISOString())
      .gt('end_time', request.startsAt.toISOString());

    if (existingAppointments && existingAppointments.length > 0) {
      const result: CreateReservationResult = {
        success: false,
        error: 'Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitpunkt.',
        errorCode: 'SLOT_ALREADY_TAKEN',
      };
      return result;
    }

    // Create appointment with reserved status
    const reservationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min reservation

    console.log('[Booking] Creating appointment with:', {
      salon_id: request.salonId,
      staff_id: request.staffId,
      customer_id: request.customerId || null,
      start_time: request.startsAt.toISOString(),
      end_time: endsAt.toISOString(),
      customer_name: request.customerName,
    });

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        salon_id: request.salonId,
        staff_id: request.staffId,
        customer_id: request.customerId || null,
        start_time: request.startsAt.toISOString(),
        end_time: endsAt.toISOString(),
        duration_minutes: totalDuration,
        status: 'reserved',
        reserved_at: new Date().toISOString(),
        reservation_expires_at: reservationExpires.toISOString(),
        subtotal_cents: totalPrice,
        total_cents: totalPrice,
        customer_name: request.customerName,
        customer_email: request.customerEmail,
        customer_phone: request.customerPhone,
        customer_notes: request.notes || null,
        payment_method: request.paymentMethod === 'online' ? 'stripe_card' : 'cash',
        booked_online: true,
      })
      .select('id')
      .single();

    console.log('[Booking] Insert result:', { appointment, error: appointmentError });

    if (appointmentError || !appointment) {
      // Check if it's a unique constraint violation (double booking)
      if (appointmentError?.code === '23505') {
        const result: CreateReservationResult = {
          success: false,
          error: 'Dieser Termin wurde soeben vergeben. Bitte wählen Sie einen anderen Zeitpunkt.',
          errorCode: 'SLOT_ALREADY_TAKEN',
        };
        return result;
      }
      console.error('Error creating appointment:', appointmentError);
      return { success: false, error: 'Fehler beim Erstellen des Termins.', errorCode: 'SERVER_ERROR' };
    }

    // Create appointment_services entries
    const appointmentServices = services.map((s, index) => ({
      appointment_id: appointment.id,
      service_id: s.id,
      price_cents: s.price_cents,
      duration_minutes: s.duration_minutes,
      service_name: s.name,
      sort_order: index,
    }));

    const { error: servicesError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices);

    if (servicesError) {
      console.error('Error creating appointment services:', servicesError);
      // Rollback appointment
      await supabase.from('appointments').delete().eq('id', appointment.id);
      return { success: false, error: 'Fehler beim Erstellen des Termins.', errorCode: 'SERVER_ERROR' };
    }

    const result: CreateReservationResult = { success: true, appointmentId: appointment.id };

    // Store idempotency result
    if (idempotencyKey) {
      await supabase
        .from('idempotency_keys')
        .update({ entity_id: appointment.id, result })
        .eq('key', idempotencyKey);
    }

    return result;
  } catch (error) {
    console.error('Reservation error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.', errorCode: 'SERVER_ERROR' };
  }
}

// ============================================
// CONFIRM APPOINTMENT
// ============================================

interface ConfirmAppointmentOptions {
  appointmentId: string;
  acceptedLegalDocuments?: {
    type: 'agb' | 'datenschutz';
    version: number;
  }[];
  ipAddress?: string;
  userAgent?: string;
}

export async function confirmAppointment(
  appointmentId: string,
  options?: Partial<ConfirmAppointmentOptions>
): Promise<BookingConfirmation | { error: string }> {
  const supabase = createServerClient();

  // Get appointment with staff, services, and customer info
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      total_cents,
      status,
      customer_name,
      customer_email,
      salon_id,
      staff:staff_id (display_name),
      appointment_services (
        service_id,
        service_name,
        duration_minutes,
        price_cents
      )
    `)
    .eq('id', appointmentId)
    .single();

  if (error || !appointment) {
    return { error: 'Termin nicht gefunden.' };
  }

  if (appointment.status !== 'reserved') {
    return { error: 'Termin ist nicht mehr reserviert.' };
  }

  // Generate booking number
  const bookingNumber = `SW-${Date.now().toString(36).toUpperCase()}`;

  // Update to confirmed
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      reservation_expires_at: null,
      booking_number: bookingNumber,
    })
    .eq('id', appointmentId);

  if (updateError) {
    return { error: 'Fehler beim Bestätigen des Termins.' };
  }

  // Record legal document acceptances
  if (options?.acceptedLegalDocuments && options.acceptedLegalDocuments.length > 0) {
    const acceptances = options.acceptedLegalDocuments.map((doc) => ({
      profile_id: null, // Will be filled if customer is logged in
      customer_id: appointment.customer_id,
      legal_document_type: doc.type,
      legal_document_version: doc.version,
      appointment_id: appointmentId,
      ip_address: options.ipAddress || null,
      user_agent: options.userAgent || null,
      accepted_at: new Date().toISOString(),
    }));

    await supabase
      .from('legal_document_acceptances')
      .insert(acceptances)
      .catch((err) => {
        console.warn('Failed to record legal acceptances:', err);
      });
  }

  // Get salon info for email
  const { data: salon } = await supabase
    .from('salons')
    .select('name, address, zip_code, city, phone')
    .eq('id', appointment.salon_id)
    .single();

  // Send confirmation email
  if (appointment.customer_email && salon) {
    const services = appointment.appointment_services.map((s: any) => ({
      name: s.service_name,
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents,
    }));

    await sendBookingConfirmationEmail({
      customerName: appointment.customer_name || 'Kunde',
      customerEmail: appointment.customer_email,
      bookingNumber,
      appointmentId: appointment.id,
      startsAt: new Date(appointment.start_time),
      endsAt: new Date(appointment.end_time),
      staffName: (appointment.staff as any)?.display_name || 'Ihr Stylist',
      services,
      totalPriceCents: appointment.total_cents,
      salonName: salon.name,
      salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
      salonPhone: salon.phone || '+41 71 222 81 82',
    }).catch((err) => {
      // Log but don't fail the booking
      console.error('Failed to send confirmation email:', err);
    });
  }

  return {
    appointmentId: appointment.id,
    bookingNumber,
    status: 'confirmed',
    startsAt: new Date(appointment.start_time),
    endsAt: new Date(appointment.end_time),
    staffName: (appointment.staff as any)?.display_name || 'Unbekannt',
    services: appointment.appointment_services.map((s: any) => ({
      serviceId: s.service_id,
      name: s.service_name,
      duration: s.duration_minutes,
      price: s.price_cents,
    })),
    totalPrice: appointment.total_cents,
  };
}

// ============================================
// MARK APPOINTMENT AS NO-SHOW (Admin)
// ============================================

export type NoShowResult = {
  success: boolean;
  noShowFeeCents?: number;
  error?: string;
};

export async function markAppointmentNoShow(
  appointmentId: string,
  options?: {
    noShowFeeCents?: number;
    reason?: string;
    actorId?: string;
  }
): Promise<NoShowResult> {
  const supabase = createServerClient();

  try {
    // Get appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        total_cents,
        salon_id,
        booking_number,
        customer_email
      `)
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Termin nicht gefunden.' };
    }

    // Only confirmed appointments can be marked as no-show
    if (appointment.status !== 'confirmed') {
      return { success: false, error: 'Nur bestätigte Termine können als No-Show markiert werden.' };
    }

    // Calculate no-show fee if not provided
    let noShowFeeCents = options?.noShowFeeCents;
    if (noShowFeeCents === undefined) {
      // Get salon settings for default no-show fee
      const { data: salon } = await supabase
        .from('salons')
        .select('no_show_fee_percent, no_show_fee_flat_cents')
        .eq('id', appointment.salon_id)
        .single();

      if (salon?.no_show_fee_flat_cents) {
        noShowFeeCents = salon.no_show_fee_flat_cents;
      } else if (salon?.no_show_fee_percent) {
        noShowFeeCents = Math.round(
          (appointment.total_cents * salon.no_show_fee_percent) / 100
        );
      } else {
        noShowFeeCents = 0;
      }
    }

    // Update appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'no_show',
        no_show_fee_cents: noShowFeeCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error marking no-show:', updateError);
      return { success: false, error: 'Fehler beim Markieren als No-Show.' };
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      action: 'mark_no_show',
      entity_type: 'appointment',
      entity_id: appointmentId,
      actor_id: options?.actorId || null,
      actor_type: options?.actorId ? 'user' : 'system',
      details: {
        booking_number: appointment.booking_number,
        no_show_fee_cents: noShowFeeCents,
        reason: options?.reason,
        timestamp: new Date().toISOString(),
      },
    }).catch((e) => console.warn('Audit log failed:', e));

    return { success: true, noShowFeeCents };
  } catch (error) {
    console.error('No-show error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// MARK APPOINTMENT AS COMPLETED (Admin)
// ============================================

export type CompleteResult = {
  success: boolean;
  error?: string;
};

// ============================================
// ADMIN UPDATE APPOINTMENT TIME
// ============================================

export type AdminUpdateTimeResult = {
  success: boolean;
  error?: string;
};

export async function adminUpdateAppointmentTime(
  appointmentId: string,
  startTime: string,
  endTime: string,
  durationMinutes?: number
): Promise<AdminUpdateTimeResult> {
  const supabase = createServerClient();

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const updateData: Record<string, unknown> = {
      start_time: startTime,
      end_time: endTime,
    };

    if (durationMinutes !== undefined) {
      updateData.duration_minutes = durationMinutes;
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminUpdateAppointmentTime] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminUpdateAppointmentTime] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN CANCEL APPOINTMENT
// ============================================

export type AdminCancelResult = {
  success: boolean;
  error?: string;
};

export async function adminCancelAppointment(
  appointmentId: string
): Promise<AdminCancelResult> {
  const supabase = createServerClient();

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminCancelAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminCancelAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// ADMIN CONFIRM APPOINTMENT
// ============================================

export type AdminConfirmResult = {
  success: boolean;
  error?: string;
};

export async function adminConfirmAppointment(
  appointmentId: string
): Promise<AdminConfirmResult> {
  const supabase = createServerClient();

  if (!supabase) {
    return { success: false, error: 'Database nicht verfügbar' };
  }

  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('[adminConfirmAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[adminConfirmAppointment] Exception:', err);
    return { success: false, error: 'Unbekannter Fehler' };
  }
}

// ============================================
// GET APPOINTMENTS FOR ADMIN CALENDAR
// ============================================

export interface AdminCalendarAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booking_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  appointment_services: {
    service_id: string;
    service_name: string;
    duration_minutes: number;
  }[];
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
}

export async function getAdminCalendarAppointments(
  salonId: string,
  startDate: string,
  endDate: string,
  staffIds: string[]
): Promise<AdminCalendarAppointment[]> {
  const supabase = createServerClient();

  if (!supabase) {
    console.error('[getAdminCalendarAppointments] Supabase client not available');
    return [];
  }

  console.log('[getAdminCalendarAppointments] Fetching:', { salonId, startDate, endDate, staffIds });

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      status,
      notes,
      booking_number,
      customer_name,
      customer_email,
      customer_phone,
      customers (
        id,
        first_name,
        last_name
      ),
      appointment_services (
        service_id,
        service_name,
        duration_minutes
      ),
      staff (
        id,
        display_name,
        color
      )
    `)
    .eq('salon_id', salonId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .in('staff_id', staffIds.length > 0 ? staffIds : ['none'])
    .neq('status', 'cancelled')
    .order('start_time');

  if (error) {
    console.error('[getAdminCalendarAppointments] Error:', error);
    return [];
  }

  console.log('[getAdminCalendarAppointments] Found', data?.length || 0, 'appointments');

  return (data || []).map((apt: any) => ({
    id: apt.id,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status,
    notes: apt.notes,
    booking_number: apt.booking_number,
    customer_name: apt.customer_name,
    customer_email: apt.customer_email,
    customer_phone: apt.customer_phone,
    customer: apt.customers,
    appointment_services: apt.appointment_services || [],
    staff: apt.staff,
  }));
}

// ============================================
// MARK APPOINTMENT AS COMPLETED (Admin)
// ============================================

export async function markAppointmentCompleted(
  appointmentId: string,
  options?: {
    actualTotalCents?: number;
    notes?: string;
    actorId?: string;
  }
): Promise<CompleteResult> {
  const supabase = createServerClient();

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Termin nicht gefunden.' };
    }

    if (appointment.status !== 'confirmed') {
      return { success: false, error: 'Nur bestätigte Termine können als abgeschlossen markiert werden.' };
    }

    const updateData: Record<string, any> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (options?.actualTotalCents !== undefined) {
      updateData.actual_total_cents = options.actualTotalCents;
    }

    if (options?.notes) {
      updateData.staff_notes = options.notes;
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error completing appointment:', updateError);
      return { success: false, error: 'Fehler beim Abschliessen des Termins.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Complete error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}
