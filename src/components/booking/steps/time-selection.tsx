'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBooking } from '../booking-context';
import type { AvailableSlot, SlotsByDate } from '@/lib/domain/booking';
import { groupSlotsByDate } from '@/lib/domain/booking';

// ============================================
// TIME SELECTION STEP
// ============================================

interface TimeSelectionProps {
  slots: AvailableSlot[];
  isLoading?: boolean;
  error?: string | null;
  onRefreshSlots?: () => void;
}

export function TimeSelection({
  slots,
  isLoading = false,
  error = null,
  onRefreshSlots,
}: TimeSelectionProps) {
  const { state, selectSlot, goBack, goNext, canProceed } = useBooking();

  // Current view state
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Group slots by date
  const slotsByDate = groupSlotsByDate(slots);

  // Get days in current week
  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  // Get slots for selected date
  const selectedDateSlots = selectedDate
    ? slotsByDate.find((d) => d.date === format(selectedDate, 'yyyy-MM-dd'))
        ?.slots || []
    : [];

  // Filter slots by selected staff if any
  const filteredSlots = state.selectedStaff
    ? selectedDateSlots.filter((s) => s.staffId === state.selectedStaff?.id)
    : selectedDateSlots;

  // Check if a date has available slots
  const hasSlots = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dateSlots = slotsByDate.find((d) => d.date === dateKey);
    if (!dateSlots) return false;
    if (state.selectedStaff) {
      return dateSlots.slots.some((s) => s.staffId === state.selectedStaff?.id);
    }
    return dateSlots.slots.length > 0;
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  // Handle slot selection
  const handleSlotSelect = (slot: AvailableSlot) => {
    selectSlot(slot);
  };

  // Auto-select first available date
  useEffect(() => {
    if (!selectedDate && slotsByDate.length > 0) {
      const firstDate = new Date(slotsByDate[0].date);
      setSelectedDate(firstDate);
      // Ensure the week containing this date is visible
      setCurrentWeekStart(startOfWeek(firstDate, { weekStartsOn: 1 }));
    }
  }, [slotsByDate, selectedDate]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
          <Calendar className="w-3 h-3 mr-1" />
          Schritt 3 von 4
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary via-primary/80 to-rose-400 bg-clip-text text-transparent">
          Wählen Sie Ihren Wunschtermin
        </h2>
        <p className="text-muted-foreground">
          Verfügbare Termine sind farbig markiert
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {onRefreshSlots && (
              <Button
                variant="link"
                size="sm"
                onClick={onRefreshSlots}
                className="ml-2 h-auto p-0"
              >
                Erneut versuchen
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            Verfügbare Termine werden geladen...
          </span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Calendar Navigation */}
          <Card className="card-elegant overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousWeek}
                  disabled={isBefore(
                    currentWeekStart,
                    startOfWeek(new Date(), { weekStartsOn: 1 })
                  )}
                  className="hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-center">
                  <span className="text-lg font-bold text-foreground">
                    {format(currentWeekStart, 'MMMM', { locale: de })}
                  </span>
                  <span className="text-lg font-light text-muted-foreground ml-2">
                    {format(currentWeekStart, 'yyyy', { locale: de })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextWeek}
                  className="hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Week Days */}
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const isAvailable = hasSlots(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isPast && isAvailable && setSelectedDate(day)}
                      disabled={isPast || !isAvailable}
                      className={cn(
                        'group relative flex flex-col items-center p-2 sm:p-3 rounded-xl transition-all duration-300',
                        // Selected state - prominent styling
                        isSelected && 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-105',
                        // Available but not selected - inviting styling
                        !isSelected && isAvailable && 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 hover:shadow-md hover:scale-102 hover:border-emerald-400',
                        // Not available - subtle styling
                        !isSelected && !isAvailable && 'bg-muted/30 text-muted-foreground border border-muted',
                        // Past days - very subtle
                        isPast && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span className={cn(
                        'text-xs font-medium uppercase tracking-wide',
                        isSelected ? 'text-white/80' : isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      )}>
                        {format(day, 'EEE', { locale: de })}
                      </span>
                      <span
                        className={cn(
                          'text-xl font-bold mt-0.5',
                          isSelected ? 'text-white' : isToday(day) ? 'text-primary' : isAvailable ? 'text-emerald-700 dark:text-emerald-300' : ''
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {isAvailable && !isSelected && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-background animate-pulse" />
                      )}
                      {isSelected && (
                        <span className="text-[10px] text-white/90 mt-1 font-medium">Ausgewählt</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          {selectedDate && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {isToday(selectedDate)
                    ? 'Verfügbare Zeiten heute'
                    : `Verfügbare Zeiten am ${format(selectedDate, 'EEEE, d. MMMM', { locale: de })}`}
                </h3>
              </div>

              {filteredSlots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {filteredSlots.map((slot) => {
                    const isSelected =
                      state.selectedSlot?.startsAt.getTime() ===
                      slot.startsAt.getTime();

                    return (
                      <button
                        key={`${slot.staffId}-${slot.startsAt.toISOString()}`}
                        onClick={() => handleSlotSelect(slot)}
                        className={cn(
                          'group relative p-3 sm:p-4 rounded-xl text-center transition-all duration-300',
                          isSelected
                            ? 'bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30 scale-105'
                            : 'bg-white dark:bg-card border-2 border-primary/20 hover:border-primary hover:shadow-md hover:scale-102 hover:bg-primary/5'
                        )}
                      >
                        <Clock className={cn(
                          'h-4 w-4 mx-auto mb-1',
                          isSelected ? 'text-white/80' : 'text-primary'
                        )} />
                        <span className={cn(
                          'text-base sm:text-lg font-bold block',
                          isSelected ? 'text-white' : 'text-foreground'
                        )}>
                          {format(slot.startsAt, 'HH:mm')}
                        </span>
                        {!state.selectedStaff && !state.noStaffPreference && (
                          <span className={cn(
                            'block text-xs mt-1 font-medium',
                            isSelected ? 'text-white/80' : 'text-primary/70'
                          )}>
                            {slot.staffName.split(' ')[0]}
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-primary rounded-full flex items-center justify-center shadow-md">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-muted">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      Keine verfügbaren Termine an diesem Tag
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Bitte wählen Sie einen anderen Tag
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-border/50">
        <Button
          variant="ghost"
          onClick={goBack}
          className="gap-2 hover:bg-muted/50"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Button>
        <Button
          onClick={goNext}
          disabled={!canProceed}
          className="gap-2 btn-glow bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          Weiter
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
