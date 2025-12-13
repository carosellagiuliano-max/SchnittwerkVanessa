'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  MoreHorizontal,
  User,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile: {
    email: string;
    phone: string | null;
  } | null;
  created_at: string;
  is_active: boolean;
  appointments: { count: number }[];
}

interface AdminCustomerListProps {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  initialSearch: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

interface Staff {
  id: string;
  display_name: string;
  salon_id: string;
}

interface AppointmentForm {
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  notes: string;
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================
// ADMIN CUSTOMER LIST
// ============================================

export function AdminCustomerList({
  customers,
  total,
  page,
  limit,
  initialSearch,
}: AdminCustomerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  // Appointment dialog state
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentCustomer, setAppointmentCustomer] = useState<Customer | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [isLoadingAppointmentData, setIsLoadingAppointmentData] = useState(false);
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>({
    serviceId: '',
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    notes: '',
  });

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/kunden?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/admin/kunden?${params.toString()}`);
  };

  const handleViewCustomer = (customer: Customer) => {
    router.push(`/admin/kunden/${customer.id}`);
  };

  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;

    try {
      const supabase = createBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('customers') as any)
        .delete()
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      toast.success('Kunde erfolgreich gelöscht');
      router.refresh();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Fehler beim Löschen des Kunden');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    router.push(`/admin/kunden/${customer.id}?edit=true`);
  };

  const handleOpenAppointmentDialog = (customer: Customer) => {
    setAppointmentCustomer(customer);
    setAppointmentForm({
      serviceId: '',
      staffId: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      notes: '',
    });
    setAppointmentDialogOpen(true);
  };

  // Fetch services and staff when appointment dialog opens
  useEffect(() => {
    if (appointmentDialogOpen) {
      const fetchData = async () => {
        setIsLoadingAppointmentData(true);
        try {
          const supabase = createBrowserClient();

          // Fetch active services
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: servicesData } = await (supabase
            .from('services') as any)
            .select('id, name, duration_minutes, price_cents')
            .eq('is_active', true)
            .order('name');

          // Fetch active staff
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: staffData } = await (supabase
            .from('staff') as any)
            .select('id, display_name, salon_id')
            .eq('is_active', true)
            .eq('is_bookable', true)
            .order('display_name');

          setServices(servicesData || []);
          setStaffMembers(staffData || []);
        } catch (error) {
          console.error('Error fetching appointment data:', error);
          toast.error('Fehler beim Laden der Daten');
        } finally {
          setIsLoadingAppointmentData(false);
        }
      };
      fetchData();
    }
  }, [appointmentDialogOpen]);

  const handleCreateAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentCustomer) return;

    setIsCreatingAppointment(true);

    try {
      const supabase = createBrowserClient();

      // Find selected service and staff
      const selectedService = services.find(s => s.id === appointmentForm.serviceId);
      const selectedStaff = staffMembers.find(s => s.id === appointmentForm.staffId);

      if (!selectedService || !selectedStaff) {
        toast.error('Bitte wählen Sie Service und Mitarbeiter');
        return;
      }

      // Calculate start and end time
      const startTime = new Date(`${appointmentForm.date}T${appointmentForm.time}:00`);
      const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);

      // Create the appointment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: appointment, error: appointmentError } = await (supabase
        .from('appointments') as any)
        .insert({
          salon_id: selectedStaff.salon_id,
          customer_id: appointmentCustomer.id,
          staff_id: selectedStaff.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: selectedService.duration_minutes,
          status: 'confirmed',
          subtotal_cents: selectedService.price_cents,
          total_cents: selectedService.price_cents,
          booked_online: false,
          notes: appointmentForm.notes || null,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Create appointment_services entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: serviceError } = await (supabase
        .from('appointment_services') as any)
        .insert({
          appointment_id: appointment.id,
          service_id: selectedService.id,
          service_name: selectedService.name,
          duration_minutes: selectedService.duration_minutes,
          price_cents: selectedService.price_cents,
          sort_order: 0,
        });

      if (serviceError) throw serviceError;

      toast.success(`Termin für ${appointmentCustomer.first_name} ${appointmentCustomer.last_name} erstellt`);
      setAppointmentDialogOpen(false);
      setAppointmentCustomer(null);
      router.refresh();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error('Fehler beim Erstellen des Termins');
    } finally {
      setIsCreatingAppointment(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const supabase = createBrowserClient();

      // Create customer directly (without profile for walk-in customers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: customerError } = await (supabase
        .from('customers') as any)
        .insert({
          salon_id: '550e8400-e29b-41d4-a716-446655440001', // Default salon
          first_name: newCustomer.first_name,
          last_name: newCustomer.last_name,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
        });

      if (customerError) throw customerError;

      toast.success('Kunde erfolgreich erstellt');
      setCreateDialogOpen(false);
      setNewCustomer({ first_name: '', last_name: '', email: '', phone: '' });
      router.refresh();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Fehler beim Erstellen des Kunden');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} Kunden insgesamt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button type="submit" variant="secondary">
              Suchen
            </Button>
          </form>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Kunde
          </Button>
        </div>
      </div>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-center">Termine</TableHead>
                <TableHead>Erstellt am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Keine Kunden gefunden</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <button
                        onClick={() => handleViewCustomer(customer)}
                        className="font-medium hover:text-primary transition-colors text-left"
                      >
                        {customer.first_name} {customer.last_name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {(customer.profile?.email || customer.email) ? (
                        <a
                          href={`mailto:${customer.profile?.email || customer.email}`}
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {customer.profile?.email || customer.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(customer.profile?.phone || customer.phone) ? (
                        <a
                          href={`tel:${customer.profile?.phone || customer.phone}`}
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {customer.profile?.phone || customer.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {customer.appointments?.[0]?.count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(customer.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? 'default' : 'outline'}>
                        {customer.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewCustomer(customer)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenAppointmentDialog(customer)}
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            Termin erstellen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(customer)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunde löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie {selectedCustomer?.first_name}{' '}
              {selectedCustomer?.last_name} löschen möchten? Diese Aktion kann
              nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Kunden erstellen</DialogTitle>
            <DialogDescription>
              Geben Sie die Kundendaten ein, um einen neuen Kunden anzulegen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={newCustomer.first_name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={newCustomer.last_name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Erstelle...' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointment Dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Termin erstellen</DialogTitle>
            <DialogDescription>
              Neuen Termin für {appointmentCustomer?.first_name} {appointmentCustomer?.last_name} erstellen.
            </DialogDescription>
          </DialogHeader>

          {isLoadingAppointmentData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleCreateAppointmentSubmit}>
              <div className="space-y-4 py-4">
                {/* Service Selection */}
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select
                    value={appointmentForm.serviceId}
                    onValueChange={(value) =>
                      setAppointmentForm({ ...appointmentForm, serviceId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Service wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{service.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {service.duration_minutes} Min. • CHF {(service.price_cents / 100).toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Staff Selection */}
                <div className="space-y-2">
                  <Label>Mitarbeiter</Label>
                  <Select
                    value={appointmentForm.staffId}
                    onValueChange={(value) =>
                      setAppointmentForm({ ...appointmentForm, staffId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mitarbeiter wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-date">Datum</Label>
                    <Input
                      id="appointment-date"
                      type="date"
                      value={appointmentForm.date}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, date: e.target.value })
                      }
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointment-time">Uhrzeit</Label>
                    <Input
                      id="appointment-time"
                      type="time"
                      value={appointmentForm.time}
                      onChange={(e) =>
                        setAppointmentForm({ ...appointmentForm, time: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="appointment-notes">Notizen (optional)</Label>
                  <Textarea
                    id="appointment-notes"
                    value={appointmentForm.notes}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, notes: e.target.value })
                    }
                    placeholder="Interne Notizen zum Termin..."
                    rows={3}
                  />
                </div>

                {/* Summary */}
                {appointmentForm.serviceId && appointmentForm.staffId && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {services.find(s => s.id === appointmentForm.serviceId)?.duration_minutes} Minuten
                      </span>
                      <span className="ml-auto font-medium text-foreground">
                        CHF {((services.find(s => s.id === appointmentForm.serviceId)?.price_cents || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAppointmentDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingAppointment || !appointmentForm.serviceId || !appointmentForm.staffId}
                >
                  {isCreatingAppointment ? (
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
