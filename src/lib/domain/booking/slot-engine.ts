import {
  addMinutes,
  addDays,
  startOfDay,
  endOfDay,
  isBefore,
  isAfter,
  differenceInMinutes,
  format,
  setHours,
  setMinutes,
  getDay,
  isToday,
  isTomorrow,
} from 'date-fns';
import { de } from 'date-fns/locale';
import type {
  SlotEngineInput,
  AvailableSlot,
  SlotsByDate,
  TimeInterval,
  DayOpeningHours,
  StaffWorkingHours,
  StaffAbsence,
  BlockedTime,
  ExistingAppointment,
  BookingRules,
  BookableService,
  BookableStaff,
} from './types';

// ============================================
// SLOT ENGINE
// ============================================

/**
 * Default booking rules
 */
const DEFAULT_BOOKING_RULES: BookingRules = {
  slotGranularityMinutes: 15,
  leadTimeMinutes: 60, // 1 hour minimum
  horizonDays: 30, // 30 days in advance
  bufferBetweenMinutes: 0,
  allowMultipleServices: true,
  requireDeposit: false,
  cancellationDeadlineHours: 24,
};

/**
 * Compute available slots for the given input
 */
export async function computeAvailableSlots(
  input: SlotEngineInput,
  data: {
    services: BookableService[];
    openingHours: DayOpeningHours[];
    staff: BookableStaff[];
    staffWorkingHours: StaffWorkingHours[];
    staffAbsences: StaffAbsence[];
    blockedTimes: BlockedTime[];
    existingAppointments: ExistingAppointment[];
    bookingRules?: Partial<BookingRules>;
  }
): Promise<AvailableSlot[]> {
  const {
    services,
    openingHours,
    staff,
    staffWorkingHours,
    staffAbsences,
    blockedTimes,
    existingAppointments,
    bookingRules: customRules,
  } = data;

  const bookingRules = { ...DEFAULT_BOOKING_RULES, ...customRules };

  // Calculate total duration from selected services
  const totalDuration = calculateTotalDuration(services, bookingRules);

  // Filter staff by skills (can perform all selected services)
  const qualifiedStaff = filterStaffBySkills(
    staff,
    input.serviceIds,
    input.preferredStaffId
  );

  const slots: AvailableSlot[] = [];
  const now = new Date();

  // Iterate through each day in the range
  for (
    let day = startOfDay(input.dateRangeStart);
    isBefore(day, endOfDay(input.dateRangeEnd));
    day = addDays(day, 1)
  ) {
    // Check if within booking window
    if (!isWithinBookingWindow(day, now, bookingRules)) {
      continue;
    }

    // Get opening hours for this day
    const dayOpeningHours = getOpeningHoursForDay(openingHours, day);
    if (!dayOpeningHours || dayOpeningHours.isClosed) {
      continue;
    }

    // For each qualified staff member
    for (const staffMember of qualifiedStaff) {
      // Compute available intervals for this staff on this day
      const availableIntervals = computeAvailableIntervals({
        day,
        staff: staffMember,
        dayOpeningHours,
        staffWorkingHours,
        staffAbsences,
        blockedTimes,
        existingAppointments,
        totalDuration,
        slotGranularity: bookingRules.slotGranularityMinutes,
        bufferMinutes: bookingRules.bufferBetweenMinutes,
        leadTimeMinutes: bookingRules.leadTimeMinutes,
        now,
      });

      // Generate slots from intervals
      for (const interval of availableIntervals) {
        const intervalSlots = generateSlotsFromInterval(
          interval,
          totalDuration,
          bookingRules.slotGranularityMinutes
        );

        slots.push(
          ...intervalSlots.map((slot) => ({
            staffId: staffMember.id,
            staffName: staffMember.name,
            startsAt: slot.start,
            endsAt: addMinutes(slot.start, totalDuration),
            totalDuration,
            services: services.map((s) => ({
              serviceId: s.id,
              name: s.name,
              duration: s.durationMinutes,
              price: s.currentPrice,
            })),
          }))
        );
      }
    }
  }

  // Sort slots by start time, then by staff name
  return sortSlots(slots);
}

/**
 * Group slots by date for UI display
 */
export function groupSlotsByDate(slots: AvailableSlot[]): SlotsByDate[] {
  const grouped = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    const dateKey = format(slot.startsAt, 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) || [];
    existing.push(slot);
    grouped.set(dateKey, existing);
  }

  const result: SlotsByDate[] = [];
  for (const [dateKey, dateSlots] of grouped) {
    const date = new Date(dateKey);
    result.push({
      date: dateKey,
      displayDate: formatDisplayDate(date),
      slots: dateSlots,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate total duration from services
 */
function calculateTotalDuration(
  services: BookableService[],
  rules: BookingRules
): number {
  const serviceDuration = services.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  // Add buffer between services if multiple
  const bufferTime =
    services.length > 1
      ? (services.length - 1) * rules.bufferBetweenMinutes
      : 0;
  return serviceDuration + bufferTime;
}

/**
 * Filter staff by their ability to perform all selected services
 */
function filterStaffBySkills(
  staff: BookableStaff[],
  serviceIds: string[],
  preferredStaffId?: string
): BookableStaff[] {
  let qualified = staff.filter(
    (s) =>
      s.isBookable && serviceIds.every((sid) => s.serviceIds.includes(sid))
  );

  // If preferred staff is specified and qualified, put them first
  if (preferredStaffId) {
    const preferred = qualified.find((s) => s.id === preferredStaffId);
    if (preferred) {
      qualified = [
        preferred,
        ...qualified.filter((s) => s.id !== preferredStaffId),
      ];
    }
  }

  return qualified;
}

/**
 * Check if a date is within the booking window
 */
function isWithinBookingWindow(
  day: Date,
  now: Date,
  rules: BookingRules
): boolean {
  const minDate = addMinutes(now, rules.leadTimeMinutes);
  const maxDate = addDays(startOfDay(now), rules.horizonDays);

  return !isBefore(endOfDay(day), minDate) && !isAfter(startOfDay(day), maxDate);
}

/**
 * Get opening hours for a specific day
 */
function getOpeningHoursForDay(
  openingHours: DayOpeningHours[],
  day: Date
): DayOpeningHours | undefined {
  const dayOfWeek = getDay(day);
  return openingHours.find((oh) => oh.dayOfWeek === dayOfWeek);
}

/**
 * Format date for display
 */
function formatDisplayDate(date: Date): string {
  if (isToday(date)) return 'Heute';
  if (isTomorrow(date)) return 'Morgen';
  return format(date, 'EEE, d. MMM', { locale: de });
}

interface IntervalParams {
  day: Date;
  staff: BookableStaff;
  dayOpeningHours: DayOpeningHours;
  staffWorkingHours: StaffWorkingHours[];
  staffAbsences: StaffAbsence[];
  blockedTimes: BlockedTime[];
  existingAppointments: ExistingAppointment[];
  totalDuration: number;
  slotGranularity: number;
  bufferMinutes: number;
  leadTimeMinutes: number;
  now: Date;
}

/**
 * Compute available intervals for a staff member on a day
 */
function computeAvailableIntervals(params: IntervalParams): TimeInterval[] {
  const {
    day,
    staff,
    dayOpeningHours,
    staffWorkingHours,
    staffAbsences,
    blockedTimes,
    existingAppointments,
    totalDuration,
    bufferMinutes,
    leadTimeMinutes,
    now,
  } = params;

  // Start with salon opening hours
  let intervals: TimeInterval[] = [
    {
      start: combineDateAndTime(day, dayOpeningHours.openTime),
      end: combineDateAndTime(day, dayOpeningHours.closeTime),
    },
  ];

  // Intersect with staff working hours
  const staffHours = getStaffHoursForDay(staffWorkingHours, staff.id, day);
  if (staffHours) {
    intervals = intersectIntervals(intervals, [
      {
        start: combineDateAndTime(day, staffHours.startTime),
        end: combineDateAndTime(day, staffHours.endTime),
      },
    ]);
  }

  // Subtract staff absences
  const absences = getAbsencesForDay(staffAbsences, staff.id, day);
  intervals = subtractIntervals(intervals, absences);

  // Subtract blocked times
  const blocked = getBlockedTimesForDay(blockedTimes, staff.id, day);
  intervals = subtractIntervals(intervals, blocked);

  // Subtract existing appointments (with buffer)
  const appointments = getAppointmentsForDay(
    existingAppointments,
    staff.id,
    day
  ).map((apt) => ({
    start: addMinutes(apt.startsAt, -bufferMinutes),
    end: addMinutes(apt.endsAt, bufferMinutes),
  }));
  intervals = subtractIntervals(intervals, appointments);

  // Apply lead time for today
  if (isToday(day)) {
    const minStartTime = addMinutes(now, leadTimeMinutes);
    intervals = intervals
      .map((interval) => ({
        start: isAfter(minStartTime, interval.start)
          ? minStartTime
          : interval.start,
        end: interval.end,
      }))
      .filter((interval) => isBefore(interval.start, interval.end));
  }

  // Filter intervals that are too short
  return intervals.filter(
    (i) => differenceInMinutes(i.end, i.start) >= totalDuration
  );
}

/**
 * Combine a date and time string (HH:mm) into a Date
 */
function combineDateAndTime(day: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return setMinutes(setHours(startOfDay(day), hours), minutes);
}

/**
 * Get staff working hours for a specific day
 */
function getStaffHoursForDay(
  workingHours: StaffWorkingHours[],
  staffId: string,
  day: Date
): StaffWorkingHours | undefined {
  const dayOfWeek = getDay(day);
  return workingHours.find(
    (wh) => wh.staffId === staffId && wh.dayOfWeek === dayOfWeek
  );
}

/**
 * Get absences for a staff member on a day
 */
function getAbsencesForDay(
  absences: StaffAbsence[],
  staffId: string,
  day: Date
): TimeInterval[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return absences
    .filter(
      (a) =>
        a.staffId === staffId &&
        isBefore(a.startsAt, dayEnd) &&
        isAfter(a.endsAt, dayStart)
    )
    .map((a) => ({
      start: isAfter(a.startsAt, dayStart) ? a.startsAt : dayStart,
      end: isBefore(a.endsAt, dayEnd) ? a.endsAt : dayEnd,
    }));
}

/**
 * Get blocked times for a staff member on a day
 * Includes both staff-specific blocks and salon-wide blocks (staffId null)
 */
function getBlockedTimesForDay(
  blockedTimes: BlockedTime[],
  staffId: string,
  day: Date
): TimeInterval[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return blockedTimes
    .filter(
      (b) =>
        // Match staff-specific blocks OR salon-wide blocks (null staffId)
        (b.staffId === staffId || b.staffId === null) &&
        isBefore(b.startsAt, dayEnd) &&
        isAfter(b.endsAt, dayStart)
    )
    .map((b) => ({
      start: isAfter(b.startsAt, dayStart) ? b.startsAt : dayStart,
      end: isBefore(b.endsAt, dayEnd) ? b.endsAt : dayEnd,
    }));
}

/**
 * Get appointments for a staff member on a day
 */
function getAppointmentsForDay(
  appointments: ExistingAppointment[],
  staffId: string,
  day: Date
): ExistingAppointment[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return appointments.filter(
    (a) =>
      a.staffId === staffId &&
      isBefore(a.startsAt, dayEnd) &&
      isAfter(a.endsAt, dayStart) &&
      !['cancelled', 'no_show'].includes(a.status)
  );
}

/**
 * Intersect two sets of intervals
 */
function intersectIntervals(
  a: TimeInterval[],
  b: TimeInterval[]
): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const intervalA of a) {
    for (const intervalB of b) {
      const start = isAfter(intervalA.start, intervalB.start)
        ? intervalA.start
        : intervalB.start;
      const end = isBefore(intervalA.end, intervalB.end)
        ? intervalA.end
        : intervalB.end;

      if (isBefore(start, end)) {
        result.push({ start, end });
      }
    }
  }

  return result;
}

/**
 * Subtract intervals from a set of intervals
 */
function subtractIntervals(
  intervals: TimeInterval[],
  toSubtract: TimeInterval[]
): TimeInterval[] {
  let result = [...intervals];

  for (const sub of toSubtract) {
    const newResult: TimeInterval[] = [];

    for (const interval of result) {
      // No overlap
      if (
        !isBefore(interval.start, sub.end) ||
        !isAfter(interval.end, sub.start)
      ) {
        newResult.push(interval);
        continue;
      }

      // Part before subtraction
      if (isBefore(interval.start, sub.start)) {
        newResult.push({ start: interval.start, end: sub.start });
      }

      // Part after subtraction
      if (isAfter(interval.end, sub.end)) {
        newResult.push({ start: sub.end, end: interval.end });
      }
    }

    result = newResult;
  }

  return result;
}

/**
 * Generate slots from an interval
 */
function generateSlotsFromInterval(
  interval: TimeInterval,
  duration: number,
  granularity: number
): { start: Date }[] {
  const slots: { start: Date }[] = [];
  let current = interval.start;

  // Round up to the next granularity
  const minutes = current.getMinutes();
  const remainder = minutes % granularity;
  if (remainder !== 0) {
    current = addMinutes(current, granularity - remainder);
  }

  while (
    !isAfter(addMinutes(current, duration), interval.end) &&
    isBefore(current, interval.end)
  ) {
    slots.push({ start: new Date(current) });
    current = addMinutes(current, granularity);
  }

  return slots;
}

/**
 * Sort slots by start time, then by staff name
 */
function sortSlots(slots: AvailableSlot[]): AvailableSlot[] {
  return slots.sort((a, b) => {
    const timeCompare = a.startsAt.getTime() - b.startsAt.getTime();
    if (timeCompare !== 0) return timeCompare;
    return a.staffName.localeCompare(b.staffName);
  });
}
