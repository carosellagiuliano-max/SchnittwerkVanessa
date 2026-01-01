'use client';

import { useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';

// Type for date click event from interaction plugin
interface DateClickArg {
  date: Date;
  dateStr: string;
  allDay: boolean;
  dayEl: HTMLElement;
  jsEvent: MouseEvent;
  view: any;
}

// Type for event resize
interface EventResizeInfo {
  event: {
    id: string;
    start: Date | null;
    end: Date | null;
    extendedProps: Record<string, any>;
  };
  revert: () => void;
}
import { format, parseISO, addMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  Loader2,
  Phone,
  Mail,
  X,
  Check,
  ChevronDown,
  Scissors,
  Ban,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { createBrowserClient } from '@/lib/supabase/client';
import { getAdminCalendarAppointments, adminCancelAppointment, adminConfirmAppointment, adminUpdateAppointmentTime } from '@/lib/actions';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Staff {
  id: string;
  display_name: string;
  color: string | null;
  is_active: boolean;
  salon_id: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booking_number: string | null;
  // Linked customer (via customer_id FK)
  customer: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  // Denormalized customer fields (for online guest bookings)
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  // Services via appointment_services join table
  appointment_services: {
    service_id: string;
    service_name: string;
    duration_minutes: number;
  }[] | null;
  staff: {
    id: string;
    display_name: string;
    color: string | null;
  } | null;
}

interface StaffBlock {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  staff?: {
    display_name: string;
    color: string | null;
  };
}

interface AdminFullCalendarProps {
  salonId: string;
  staff: Staff[];
  services: Service[];
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  profiles: {
    email: string | null;
    phone: string | null;
  } | null;
}

// Staff colors
const STAFF_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reserved: { label: 'Reserviert', color: '#f59e0b' },
  confirmed: { label: 'Bestätigt', color: '#10b981' },
  requested: { label: 'Angefragt', color: '#3b82f6' },
  completed: { label: 'Abgeschlossen', color: '#6b7280' },
  cancelled: { label: 'Storniert', color: '#ef4444' },
  no_show: { label: 'Nicht erschienen', color: '#ef4444' },
};

// ============================================
// ADMIN FULLCALENDAR COMPONENT
// ============================================

export function AdminFullCalendar({ salonId, staff, services }: AdminFullCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffBlocks, setStaffBlocks] = useState<StaffBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string[]>(staff.map(s => s.id));
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // New Appointment Dialog
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    customerId: '',
    customerSearch: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    isNewCustomer: false,
    serviceId: '',
    staffId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    sendConfirmation: true,
  });
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Block Time Dialog
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    staffId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '18:00',
    reason: 'Blockiert',
  });

  // Delete Block Dialog
  const [selectedBlock, setSelectedBlock] = useState<StaffBlock | null>(null);
  const [isDeleteBlockOpen, setIsDeleteBlockOpen] = useState(false);

  // Selection type dialog (appointment or block)
  const [isSelectionTypeOpen, setIsSelectionTypeOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Fetch appointments using server action (bypasses RLS)
  const fetchAppointments = useCallback(async (start: Date, end: Date) => {
    setIsLoading(true);

    console.log('[Calendar] Fetching appointments:', { start: start.toISOString(), end: end.toISOString(), selectedStaff, salonId });

    try {
      const data = await getAdminCalendarAppointments(
        salonId,
        start.toISOString(),
        end.toISOString(),
        selectedStaff.length > 0 ? selectedStaff : []
      );

      console.log('[Calendar] Found', data.length, 'appointments');
      setAppointments(data);
    } catch (error) {
      console.error('[Calendar] Error fetching appointments:', error);
    }

    setIsLoading(false);
  }, [selectedStaff, salonId]);

  // Fetch staff blocks
  const fetchStaffBlocks = useCallback(async (start: Date, end: Date) => {
    const supabase = createBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('staff_blocks') as any)
      .select(`
        id,
        staff_id,
        start_time,
        end_time,
        reason,
        staff (
          display_name,
          color
        )
      `)
      .gte('start_time', start.toISOString())
      .lte('end_time', end.toISOString())
      .in('staff_id', selectedStaff.length > 0 ? selectedStaff : ['none']);

    if (!error && data) {
      setStaffBlocks(data);
    } else if (error) {
      console.error('Error fetching staff blocks:', error);
    }
  }, [selectedStaff]);

  // Convert appointments to FullCalendar events
  const calendarEvents = [
    // Appointments
    ...appointments.map((apt) => {
      const staffIndex = staff.findIndex(s => s.id === apt.staff?.id);
      const staffColor = apt.staff?.color || STAFF_COLORS[staffIndex % STAFF_COLORS.length];

      // Get customer name from linked customer or denormalized fields
      const customerName = apt.customer
        ? `${apt.customer.first_name} ${apt.customer.last_name}`
        : apt.customer_name || 'Unbekannter Kunde';

      // Get service name from appointment_services
      const serviceName = apt.appointment_services && apt.appointment_services.length > 0
        ? apt.appointment_services.map(s => s.service_name).join(', ')
        : 'Unbekannt';

      return {
        id: apt.id,
        title: customerName,
        start: apt.start_time,
        end: apt.end_time,
        backgroundColor: staffColor,
        borderColor: staffColor,
        extendedProps: {
          type: 'appointment',
          appointment: apt,
          serviceName,
          staffName: apt.staff?.display_name || 'Unbekannt',
          status: apt.status,
        },
      };
    }),
    // Staff Blocks
    ...staffBlocks.map((block) => {
      const staffIndex = staff.findIndex(s => s.id === block.staff_id);
      const staffColor = block.staff?.color || STAFF_COLORS[staffIndex % STAFF_COLORS.length];

      return {
        id: `block-${block.id}`,
        title: `🚫 ${block.reason}`,
        start: block.start_time,
        end: block.end_time,
        backgroundColor: `${staffColor}40`, // semi-transparent
        borderColor: staffColor,
        textColor: staffColor,
        display: 'block',
        extendedProps: {
          type: 'block',
          block: block,
          staffName: block.staff?.display_name || 'Unbekannt',
        },
      };
    }),
  ];

  // Handle date range change
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date }) => {
    fetchAppointments(dateInfo.start, dateInfo.end);
    fetchStaffBlocks(dateInfo.start, dateInfo.end);
  }, [fetchAppointments, fetchStaffBlocks]);

  // Handle event click
  const handleEventClick = (info: EventClickArg) => {
    const eventType = info.event.extendedProps.type;

    if (eventType === 'appointment') {
      const appointment = info.event.extendedProps.appointment as Appointment;
      setSelectedAppointment(appointment);
      setIsDetailDialogOpen(true);
    } else if (eventType === 'block') {
      const block = info.event.extendedProps.block as StaffBlock;
      setSelectedBlock(block);
      setIsDeleteBlockOpen(true);
    }
  };

  // Handle date select (drag to select time range)
  const handleDateSelect = (info: DateSelectArg) => {
    const startDate = info.start;
    const endDate = info.end;

    // Show selection type dialog (appointment or block)
    setPendingSelection({ start: startDate, end: endDate });
    setIsSelectionTypeOpen(true);
  };

  // Handle single click on calendar - disabled to avoid conflict with select
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDateClick = (_info: DateClickArg) => {
    // Do nothing - selection is handled by handleDateSelect
    // This prevents both dialogs from opening on the same click
  };

  // Handle selection type choice
  const handleSelectionTypeChoice = (type: 'appointment' | 'block') => {
    setIsSelectionTypeOpen(false);

    if (!pendingSelection) return;

    const { start, end } = pendingSelection;

    if (type === 'appointment') {
      setNewAppointmentForm(prev => ({
        ...prev,
        date: format(start, 'yyyy-MM-dd'),
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        staffId: staff[0]?.id || '',
      }));
      setIsNewAppointmentOpen(true);
    } else {
      setBlockForm({
        staffId: staff[0]?.id || '',
        date: format(start, 'yyyy-MM-dd'),
        startTime: format(start, 'HH:mm'),
        endTime: format(end, 'HH:mm'),
        reason: 'Blockiert',
      });
      setIsBlockDialogOpen(true);
    }

    setPendingSelection(null);
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (info: EventDropArg) => {
    const eventType = info.event.extendedProps.type;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      if (eventType === 'appointment') {
        const appointmentId = info.event.id;
        const result = await adminUpdateAppointmentTime(
          appointmentId,
          newStart.toISOString(),
          newEnd.toISOString()
        );

        if (!result.success) throw new Error(result.error);
        toast.success('Termin verschoben');
      } else if (eventType === 'block') {
        const supabase = createBrowserClient();
        const blockId = info.event.id.replace('block-', '');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase
          .from('staff_blocks') as any)
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
          })
          .eq('id', blockId);

        if (error) throw error;
        toast.success('Blockzeit verschoben');
      }
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Fehler beim Verschieben');
      info.revert();
    }
  };

  // Handle event resize
  const handleEventResize = async (info: EventResizeInfo) => {
    const eventType = info.event.extendedProps.type;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      if (eventType === 'appointment') {
        const appointmentId = info.event.id;
        const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60000);
        const result = await adminUpdateAppointmentTime(
          appointmentId,
          newStart.toISOString(),
          newEnd.toISOString(),
          durationMinutes
        );

        if (!result.success) throw new Error(result.error);
        toast.success('Terminzeit geändert');
      } else if (eventType === 'block') {
        const supabase = createBrowserClient();
        const blockId = info.event.id.replace('block-', '');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase
          .from('staff_blocks') as any)
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
          })
          .eq('id', blockId);

        if (error) throw error;
        toast.success('Blockzeit geändert');
      }
    } catch (error) {
      console.error('Error resizing:', error);
      toast.error('Fehler beim Ändern der Zeit');
      info.revert();
    }
  };

  // Search customers
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('customers') as any)
      .select('id, first_name, last_name, profiles (email, phone)')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(5);

    if (error) {
      console.error('Error fetching customers:', error);
    }

    setCustomerResults(data || []);
    setIsSearching(false);
  };

  // Create new appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAppointmentForm.serviceId || !newAppointmentForm.staffId) {
      toast.error('Bitte Service und Mitarbeiter auswählen');
      return;
    }

    if (!newAppointmentForm.customerId && !newAppointmentForm.isNewCustomer) {
      toast.error('Bitte einen Kunden auswählen');
      return;
    }

    if (newAppointmentForm.isNewCustomer && !newAppointmentForm.customerName) {
      toast.error('Bitte Kundennamen eingeben');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createBrowserClient();
      const selectedService = services.find(s => s.id === newAppointmentForm.serviceId);
      const selectedStaffMember = staff.find(s => s.id === newAppointmentForm.staffId);

      if (!selectedService || !selectedStaffMember) {
        throw new Error('Service oder Mitarbeiter nicht gefunden');
      }

      let customerId = newAppointmentForm.customerId;
      let customerEmail = newAppointmentForm.customerEmail;

      // Create new customer if needed
      if (newAppointmentForm.isNewCustomer && newAppointmentForm.customerName) {
        const nameParts = newAppointmentForm.customerName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCustomer, error: customerError } = await (supabase
          .from('customers') as any)
          .insert({
            salon_id: selectedStaffMember.salon_id,
            first_name: firstName,
            last_name: lastName,
            email: newAppointmentForm.customerEmail || null,
            phone: newAppointmentForm.customerPhone || null,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
        customerEmail = newAppointmentForm.customerEmail;
      }

      // Calculate times
      const startTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.startTime}:00`);
      const endTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.endTime}:00`);

      // Generate booking number
      const bookingNumber = `SW-${Date.now().toString(36).toUpperCase()}`;

      // Create appointment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: appointment, error: appointmentError } = await (supabase
        .from('appointments') as any)
        .insert({
          salon_id: selectedStaffMember.salon_id,
          customer_id: customerId,
          staff_id: selectedStaffMember.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          booking_number: bookingNumber,
          subtotal_cents: selectedService.price_cents,
          total_cents: selectedService.price_cents,
          booked_online: false,
          notes: newAppointmentForm.notes || null,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Create appointment_services
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase
        .from('appointment_services') as any)
        .insert({
          appointment_id: appointment.id,
          service_id: selectedService.id,
          service_name: selectedService.name,
          duration_minutes: selectedService.duration_minutes,
          price_cents: selectedService.price_cents,
          sort_order: 0,
        });

      // Send confirmation email if requested and customer has email
      if (newAppointmentForm.sendConfirmation && customerEmail) {
        try {
          // Get salon info
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: salon } = await (supabase
            .from('salons') as any)
            .select('name, address, zip_code, city, phone')
            .eq('id', selectedStaffMember.salon_id)
            .single();

          if (salon) {
            // Call the email API
            await fetch('/api/admin/appointments/send-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appointmentId: appointment.id,
                customerName: newAppointmentForm.isNewCustomer
                  ? newAppointmentForm.customerName
                  : newAppointmentForm.customerName,
                customerEmail: customerEmail,
                bookingNumber,
                startsAt: startTime.toISOString(),
                endsAt: endTime.toISOString(),
                staffName: selectedStaffMember.display_name,
                services: [{
                  name: selectedService.name,
                  durationMinutes: selectedService.duration_minutes,
                  priceCents: selectedService.price_cents,
                }],
                totalPriceCents: selectedService.price_cents,
                salonName: salon.name,
                salonAddress: `${salon.address}, ${salon.zip_code} ${salon.city}`,
                salonPhone: salon.phone || '+41 71 222 81 82',
              }),
            });
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the appointment creation if email fails
        }
      }

      toast.success('Termin erstellt' + (newAppointmentForm.sendConfirmation && customerEmail ? ' und Bestätigung gesendet' : ''));
      setIsNewAppointmentOpen(false);
      resetNewAppointmentForm();

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error('Fehler beim Erstellen des Termins');
    } finally {
      setIsSaving(false);
    }
  };

  // Create staff block
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!blockForm.staffId) {
      toast.error('Bitte Mitarbeiter auswählen');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createBrowserClient();
      const selectedStaffMember = staff.find(s => s.id === blockForm.staffId);

      if (!selectedStaffMember) {
        throw new Error('Mitarbeiter nicht gefunden');
      }

      const startTime = new Date(`${blockForm.date}T${blockForm.startTime}:00`);
      const endTime = new Date(`${blockForm.date}T${blockForm.endTime}:00`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('staff_blocks') as any)
        .insert({
          salon_id: selectedStaffMember.salon_id,
          staff_id: selectedStaffMember.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reason: blockForm.reason || 'Blockiert',
        });

      if (error) throw error;

      toast.success('Blockzeit erstellt');
      setIsBlockDialogOpen(false);
      resetBlockForm();

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchStaffBlocks(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error creating block:', error);
      toast.error('Fehler beim Erstellen der Blockzeit');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete staff block
  const handleDeleteBlock = async () => {
    if (!selectedBlock) return;

    try {
      const supabase = createBrowserClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('staff_blocks') as any)
        .delete()
        .eq('id', selectedBlock.id);

      if (error) throw error;

      toast.success('Blockzeit gelöscht');
      setIsDeleteBlockOpen(false);
      setSelectedBlock(null);

      // Refresh calendar
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchStaffBlocks(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      toast.error('Fehler beim Löschen der Blockzeit');
    }
  };

  const resetNewAppointmentForm = () => {
    setNewAppointmentForm({
      customerId: '',
      customerSearch: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      isNewCustomer: false,
      serviceId: '',
      staffId: staff[0]?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '10:00',
      notes: '',
      sendConfirmation: true,
    });
    setCustomerResults([]);
  };

  const resetBlockForm = () => {
    setBlockForm({
      staffId: staff[0]?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '18:00',
      reason: 'Blockiert',
    });
  };

  // Cancel appointment
  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await adminCancelAppointment(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin storniert');
      setIsDetailDialogOpen(false);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast.error('Fehler beim Stornieren');
    }
  };

  // Confirm appointment
  const handleConfirmAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      const result = await adminConfirmAppointment(selectedAppointment.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Termin bestätigt');
      setIsDetailDialogOpen(false);

      // Refresh
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        const view = calendarApi.view;
        fetchAppointments(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error('Error confirming appointment:', error);
      toast.error('Fehler beim Bestätigen');
    }
  };

  // Toggle staff filter
  const toggleStaffFilter = (staffId: string) => {
    setSelectedStaff(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kalender</h1>
          <p className="text-muted-foreground">Termine und Blockzeiten verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Staff Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Mitarbeiter
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mitarbeiter filtern</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {staff.map((s, index) => (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={selectedStaff.includes(s.id)}
                  onCheckedChange={() => toggleStaffFilter(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                    />
                    {s.display_name}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New Block Button */}
          <Button variant="outline" onClick={() => {
            resetBlockForm();
            setIsBlockDialogOpen(true);
          }}>
            <Ban className="h-4 w-4 mr-2" />
            Blockzeit
          </Button>

          {/* New Appointment Button */}
          <Button onClick={() => {
            resetNewAppointmentForm();
            setIsNewAppointmentOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Termin
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          Ziehen zum Erstellen
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Klicken zum Bearbeiten
        </span>
        <span className="flex items-center gap-1">
          <Ban className="h-3 w-3" />
          Halbtransparent = Blockzeit
        </span>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: 'Heute',
              month: 'Monat',
              week: 'Woche',
              day: 'Tag',
              list: 'Liste',
            }}
            locale="de"
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            slotDuration="00:15:00"
            slotLabelInterval="01:00:00"
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            allDaySlot={false}
            nowIndicator={true}
            selectable={true}
            selectMirror={true}
            editable={true}
            eventResizableFromStart={true}
            events={calendarEvents}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            select={handleDateSelect}
            dateClick={handleDateClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            height="auto"
            contentHeight={700}
            eventContent={(eventInfo) => {
              const eventType = eventInfo.event.extendedProps.type;

              if (eventType === 'block') {
                return (
                  <div className="p-1 overflow-hidden h-full opacity-80">
                    <div className="font-medium text-xs truncate flex items-center gap-1">
                      <Ban className="h-3 w-3" />
                      {eventInfo.event.extendedProps.block?.reason || 'Blockiert'}
                    </div>
                    <div className="text-[10px] opacity-80 truncate">
                      {eventInfo.event.extendedProps.staffName}
                    </div>
                  </div>
                );
              }

              const apt = eventInfo.event.extendedProps.appointment as Appointment;
              const serviceName = apt?.appointment_services && apt.appointment_services.length > 0
                ? apt.appointment_services[0].service_name
                : 'Unbekannt';
              return (
                <div className="p-1 overflow-hidden h-full">
                  <div className="font-medium text-xs truncate">
                    {eventInfo.event.title}
                  </div>
                  <div className="text-[10px] opacity-80 truncate">
                    {serviceName}
                  </div>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Staff Legend */}
      <div className="flex flex-wrap gap-4">
        {staff.filter(s => selectedStaff.includes(s.id)).map((s, index) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
            />
            <span>{s.display_name}</span>
          </div>
        ))}
      </div>

      {/* Selection Type Dialog */}
      <Dialog open={isSelectionTypeOpen} onOpenChange={setIsSelectionTypeOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Was möchten Sie erstellen?</DialogTitle>
            <DialogDescription>
              Wählen Sie, ob Sie einen Termin oder eine Blockzeit erstellen möchten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectionTypeChoice('appointment')}
            >
              <Scissors className="h-8 w-8 text-primary" />
              <span>Termin</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => handleSelectionTypeChoice('block')}
            >
              <Ban className="h-8 w-8 text-orange-500" />
              <span>Blockzeit</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Termindetails</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge
                  style={{
                    backgroundColor: STATUS_CONFIG[selectedAppointment.status]?.color || '#6b7280',
                    color: 'white'
                  }}
                >
                  {STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(parseISO(selectedAppointment.start_time), 'EEEE, d. MMMM yyyy', { locale: de })}
                </span>
              </div>

              {/* Booking Number */}
              {selectedAppointment.booking_number && (
                <div className="text-sm text-muted-foreground text-center">
                  Buchungsnr: <span className="font-mono font-medium">{selectedAppointment.booking_number}</span>
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {format(parseISO(selectedAppointment.start_time), 'HH:mm')} - {format(parseISO(selectedAppointment.end_time), 'HH:mm')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAppointment.appointment_services && selectedAppointment.appointment_services.length > 0
                      ? selectedAppointment.appointment_services.reduce((sum, s) => sum + s.duration_minutes, 0)
                      : 0} Minuten
                  </div>
                </div>
              </div>

              {/* Customer */}
              {(selectedAppointment.customer || selectedAppointment.customer_name) && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {selectedAppointment.customer
                        ? `${selectedAppointment.customer.first_name} ${selectedAppointment.customer.last_name}`
                        : selectedAppointment.customer_name}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {selectedAppointment.customer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedAppointment.customer_email}
                        </span>
                      )}
                      {selectedAppointment.customer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedAppointment.customer_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Service */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Scissors className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {selectedAppointment.appointment_services && selectedAppointment.appointment_services.length > 0
                      ? selectedAppointment.appointment_services.map(s => s.service_name).join(', ')
                      : 'Unbekannt'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    bei {selectedAppointment.staff?.display_name}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-1">Notizen</div>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Actions */}
              <DialogFooter className="flex gap-2 sm:gap-0">
                {selectedAppointment.status !== 'confirmed' && (
                  <Button onClick={handleConfirmAppointment} className="flex-1 sm:flex-none">
                    <Check className="h-4 w-4 mr-2" />
                    Bestätigen
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={handleCancelAppointment}
                  className="flex-1 sm:flex-none"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stornieren
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neuen Termin erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Termin für einen Kunden.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment}>
            <div className="space-y-4 py-4">
              {/* Customer Search */}
              <div className="space-y-2">
                <Label>Kunde</Label>
                {!newAppointmentForm.customerId && !newAppointmentForm.isNewCustomer ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="Kunde suchen (Name oder Email)..."
                        value={newAppointmentForm.customerSearch}
                        onChange={(e) => {
                          setNewAppointmentForm(prev => ({
                            ...prev,
                            customerSearch: e.target.value
                          }));
                          searchCustomers(e.target.value);
                        }}
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />
                      )}
                    </div>
                    {customerResults.length > 0 && (
                      <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                        {customerResults.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            className="w-full p-2 text-left hover:bg-muted text-sm"
                            onClick={() => {
                              setNewAppointmentForm(prev => ({
                                ...prev,
                                customerId: customer.id,
                                customerName: `${customer.first_name} ${customer.last_name}`,
                                customerEmail: customer.profiles?.email || '',
                                customerPhone: customer.profiles?.phone || '',
                                customerSearch: '',
                              }));
                              setCustomerResults([]);
                            }}
                          >
                            <div className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </div>
                            <div className="flex gap-4 text-muted-foreground text-xs">
                              {customer.profiles?.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {customer.profiles.email}
                                </span>
                              )}
                              {customer.profiles?.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {customer.profiles.phone}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setNewAppointmentForm(prev => ({ ...prev, isNewCustomer: true }))}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Neuen Kunden anlegen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                      <div>
                        {newAppointmentForm.isNewCustomer ? (
                          <span className="text-sm text-muted-foreground">Neuer Kunde</span>
                        ) : (
                          <span className="font-medium">{newAppointmentForm.customerName}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewAppointmentForm(prev => ({
                          ...prev,
                          customerId: '',
                          customerName: '',
                          customerEmail: '',
                          customerPhone: '',
                          isNewCustomer: false,
                        }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {newAppointmentForm.isNewCustomer && (
                      <>
                        <Input
                          placeholder="Name des Kunden *"
                          value={newAppointmentForm.customerName}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerName: e.target.value
                          }))}
                        />
                        <Input
                          type="email"
                          placeholder="E-Mail (für Bestätigung)"
                          value={newAppointmentForm.customerEmail}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerEmail: e.target.value
                          }))}
                        />
                        <Input
                          type="tel"
                          placeholder="Telefon"
                          value={newAppointmentForm.customerPhone}
                          onChange={(e) => setNewAppointmentForm(prev => ({
                            ...prev,
                            customerPhone: e.target.value
                          }))}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Service */}
              <div className="space-y-2">
                <Label>Service</Label>
                <Select
                  value={newAppointmentForm.serviceId}
                  onValueChange={(value) => {
                    const service = services.find(s => s.id === value);
                    if (service) {
                      const startTime = new Date(`${newAppointmentForm.date}T${newAppointmentForm.startTime}:00`);
                      const endTime = addMinutes(startTime, service.duration_minutes);
                      setNewAppointmentForm(prev => ({
                        ...prev,
                        serviceId: value,
                        endTime: format(endTime, 'HH:mm'),
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Service wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{service.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {service.duration_minutes} Min.
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Staff */}
              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select
                  value={newAppointmentForm.staffId}
                  onValueChange={(value) => setNewAppointmentForm(prev => ({ ...prev, staffId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s, index) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                          />
                          {s.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={newAppointmentForm.date}
                    onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Von</Label>
                  <Input
                    type="time"
                    value={newAppointmentForm.startTime}
                    onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input
                    type="time"
                    value={newAppointmentForm.endTime}
                    onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notizen (optional)</Label>
                <Textarea
                  value={newAppointmentForm.notes}
                  onChange={(e) => setNewAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interne Notizen..."
                  rows={2}
                />
              </div>

              {/* Send Confirmation */}
              {(newAppointmentForm.customerEmail || (!newAppointmentForm.isNewCustomer && newAppointmentForm.customerId)) && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendConfirmation"
                    checked={newAppointmentForm.sendConfirmation}
                    onCheckedChange={(checked) => setNewAppointmentForm(prev => ({
                      ...prev,
                      sendConfirmation: checked as boolean
                    }))}
                  />
                  <Label htmlFor="sendConfirmation" className="text-sm cursor-pointer">
                    Bestätigungs-Email an Kunden senden
                  </Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Termin erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Block Time Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Blockzeit erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Blockzeit für einen Mitarbeiter. In dieser Zeit können keine Termine gebucht werden.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBlock}>
            <div className="space-y-4 py-4">
              {/* Staff */}
              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select
                  value={blockForm.staffId}
                  onValueChange={(value) => setBlockForm(prev => ({ ...prev, staffId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s, index) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color || STAFF_COLORS[index % STAFF_COLORS.length] }}
                          />
                          {s.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={blockForm.date}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Von</Label>
                  <Input
                    type="time"
                    value={blockForm.startTime}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input
                    type="time"
                    value={blockForm.endTime}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Grund</Label>
                <Input
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="z.B. Mittagspause, Meeting, Urlaub..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Blockzeit erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Block Confirmation Dialog */}
      <AlertDialog open={isDeleteBlockOpen} onOpenChange={setIsDeleteBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Blockzeit löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Blockzeit wirklich löschen?
              {selectedBlock && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <div><strong>Grund:</strong> {selectedBlock.reason}</div>
                  <div><strong>Zeit:</strong> {format(parseISO(selectedBlock.start_time), 'dd.MM.yyyy HH:mm')} - {format(parseISO(selectedBlock.end_time), 'HH:mm')}</div>
                  <div><strong>Mitarbeiter:</strong> {selectedBlock.staff?.display_name}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
