'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Save,
  Building,
  Clock,
  CreditCard,
  Mail,
  Scissors,
  Plus,
  Edit,
  Trash2,
  CalendarClock,
  Percent,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  createService,
  updateService,
  deleteService,
  restoreService,
} from '@/lib/actions/services';
import { updateOpeningHours } from '@/lib/actions';

// ============================================
// TYPES
// ============================================

interface Salon {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  website: string | null;
  description: string | null;
  opening_hours: Record<string, unknown> | null;
  is_active: boolean;
}

interface ServiceForAdmin {
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
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

interface OpeningHoursData {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

interface AdminSettingsViewProps {
  salon: Salon | null;
  services: ServiceForAdmin[];
  categories: ServiceCategory[];
  openingHours: OpeningHoursData[];
}

// ============================================
// CONSTANTS
// ============================================

// dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday (JavaScript standard)
const weekDays = [
  { dayOfWeek: 1, label: 'Montag' },
  { dayOfWeek: 2, label: 'Dienstag' },
  { dayOfWeek: 3, label: 'Mittwoch' },
  { dayOfWeek: 4, label: 'Donnerstag' },
  { dayOfWeek: 5, label: 'Freitag' },
  { dayOfWeek: 6, label: 'Samstag' },
  { dayOfWeek: 0, label: 'Sonntag' },
];

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} Std.`;
  }
  return `${hours} Std. ${mins} Min.`;
}

// ============================================
// DEFAULT SERVICE FORM VALUES
// ============================================

const defaultServiceForm = {
  name: '',
  description: '',
  categoryId: '',
  durationMinutes: 30,
  priceCents: 0,
  priceFrom: false,
  isBookableOnline: true,
};

// ============================================
// ADMIN SETTINGS VIEW
// ============================================

export function AdminSettingsView({ salon, services, categories, openingHours: initialOpeningHours }: AdminSettingsViewProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Opening hours state
  const [openingHours, setOpeningHours] = useState<OpeningHoursData[]>(initialOpeningHours);

  // Service dialog state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceForAdmin | null>(null);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceForAdmin | null>(null);

  // Show inactive services
  const [showInactive, setShowInactive] = useState(false);

  // Booking rules state
  const [bookingRules, setBookingRules] = useState({
    minNoticeHours: 24,
    maxAdvanceDays: 90,
    bufferMinutes: 15,
    allowSameDayBooking: false,
    requirePhoneForBooking: true,
  });

  // VAT settings state
  const [vatSettings, setVatSettings] = useState({
    vatRate: 8.1,
    showVatOnInvoice: true,
    vatNumber: '',
  });

  // Deposit settings state
  const [depositSettings, setDepositSettings] = useState({
    requireDeposit: false,
    depositPercent: 20,
    depositMinAmount: 2000,
    refundableUntilHours: 48,
  });

  // Filter services based on showInactive
  const filteredServices = showInactive
    ? services
    : services.filter((s) => s.isActive);

  // ============================================
  // SERVICE HANDLERS
  // ============================================

  const openAddServiceDialog = () => {
    setEditingService(null);
    setServiceForm(defaultServiceForm);
    setServiceDialogOpen(true);
  };

  const openEditServiceDialog = (service: ServiceForAdmin) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      categoryId: service.categoryId || '',
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      priceFrom: service.priceFrom,
      isBookableOnline: service.isBookableOnline,
    });
    setServiceDialogOpen(true);
  };

  const openDeleteDialog = (service: ServiceForAdmin) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    if (serviceForm.durationMinutes < 5) {
      toast.error('Mindestdauer ist 5 Minuten');
      return;
    }

    setIsSaving(true);

    try {
      if (editingService) {
        // Update existing service
        const result = await updateService({
          id: editingService.id,
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          categoryId: serviceForm.categoryId || undefined,
          durationMinutes: serviceForm.durationMinutes,
          priceCents: serviceForm.priceCents,
          priceFrom: serviceForm.priceFrom,
          isBookableOnline: serviceForm.isBookableOnline,
        });

        if (result.success) {
          toast.success('Leistung aktualisiert');
          setServiceDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Aktualisieren');
        }
      } else {
        // Create new service
        const result = await createService({
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          categoryId: serviceForm.categoryId || undefined,
          durationMinutes: serviceForm.durationMinutes,
          priceCents: serviceForm.priceCents,
          priceFrom: serviceForm.priceFrom,
          isBookableOnline: serviceForm.isBookableOnline,
        });

        if (result.success) {
          toast.success('Leistung erstellt');
          setServiceDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error || 'Fehler beim Erstellen');
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;

    setIsSaving(true);

    try {
      const result = await deleteService(serviceToDelete.id);

      if (result.success) {
        toast.success('Leistung deaktiviert');
        setDeleteDialogOpen(false);
        setServiceToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Deaktivieren');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreService = async (service: ServiceForAdmin) => {
    setIsSaving(true);

    try {
      const result = await restoreService(service.id);

      if (result.success) {
        toast.success('Leistung reaktiviert');
        router.refresh();
      } else {
        toast.error(result.error || 'Fehler beim Reaktivieren');
      }
    } catch (error) {
      console.error('Error restoring service:', error);
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality for other settings
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleSaveOpeningHours = async () => {
    setIsSaving(true);
    try {
      const result = await updateOpeningHours(openingHours);
      if (result.success) {
        toast.success('Öffnungszeiten wurden gespeichert', {
          description: 'Die Änderungen werden bei der nächsten Buchung berücksichtigt.',
        });
        router.refresh();
      } else {
        toast.error('Fehler beim Speichern', {
          description: result.error || 'Bitte versuchen Sie es erneut.',
        });
      }
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">
            <Building className="h-4 w-4 mr-2" />
            Allgemein
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4 mr-2" />
            Öffnungszeiten
          </TabsTrigger>
          <TabsTrigger value="booking">
            <CalendarClock className="h-4 w-4 mr-2" />
            Buchungsregeln
          </TabsTrigger>
          <TabsTrigger value="services">
            <Scissors className="h-4 w-4 mr-2" />
            Leistungen
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Zahlungen
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Mail className="h-4 w-4 mr-2" />
            Benachrichtigungen
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Salon-Informationen</CardTitle>
              <CardDescription>
                Grundlegende Informationen über Ihren Salon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Salon Name</Label>
                  <Input
                    id="name"
                    defaultValue={salon?.name || ''}
                    placeholder="SCHNITTWERK"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={salon?.email || ''}
                    placeholder="kontakt@salon.ch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    defaultValue={salon?.phone || ''}
                    placeholder="+41 71 123 45 67"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    defaultValue={salon?.website || ''}
                    placeholder="https://www.salon.ch"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  defaultValue={salon?.address || ''}
                  placeholder="Musterstrasse 1"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">PLZ</Label>
                  <Input
                    id="postal_code"
                    defaultValue={salon?.postal_code || ''}
                    placeholder="9000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Stadt</Label>
                  <Input
                    id="city"
                    defaultValue={salon?.city || ''}
                    placeholder="St. Gallen"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  defaultValue={salon?.description || ''}
                  placeholder="Kurze Beschreibung des Salons..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opening Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Öffnungszeiten</CardTitle>
              <CardDescription>
                Legen Sie die Öffnungszeiten Ihres Salons fest. Geschlossene Tage werden bei der Online-Buchung nicht angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weekDays.map((day) => {
                  const hours = openingHours.find(h => h.dayOfWeek === day.dayOfWeek);
                  return (
                    <div
                      key={day.dayOfWeek}
                      className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all ${
                        hours?.isOpen
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-muted/30 border-muted'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          id={`day-${day.dayOfWeek}-open`}
                          checked={hours?.isOpen ?? false}
                          onCheckedChange={(checked) => {
                            setOpeningHours(prev => prev.map(h =>
                              h.dayOfWeek === day.dayOfWeek
                                ? { ...h, isOpen: checked }
                                : h
                            ));
                          }}
                        />
                        <Label htmlFor={`day-${day.dayOfWeek}-open`} className="w-24 font-medium">
                          {day.label}
                        </Label>
                        {!hours?.isOpen && (
                          <Badge variant="secondary" className="text-xs">Geschlossen</Badge>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 transition-opacity ${hours?.isOpen ? 'opacity-100' : 'opacity-50'}`}>
                        <Input
                          type="time"
                          value={hours?.openTime || '09:00'}
                          onChange={(e) => {
                            setOpeningHours(prev => prev.map(h =>
                              h.dayOfWeek === day.dayOfWeek
                                ? { ...h, openTime: e.target.value }
                                : h
                            ));
                          }}
                          disabled={!hours?.isOpen}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">bis</span>
                        <Input
                          type="time"
                          value={hours?.closeTime || '18:00'}
                          onChange={(e) => {
                            setOpeningHours(prev => prev.map(h =>
                              h.dayOfWeek === day.dayOfWeek
                                ? { ...h, closeTime: e.target.value }
                                : h
                            ));
                          }}
                          disabled={!hours?.isOpen}
                          className="w-28"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveOpeningHours} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Öffnungszeiten speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Rules */}
        <TabsContent value="booking">
          <div className="space-y-6">
            {/* Booking Time Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Zeitliche Regeln</CardTitle>
                <CardDescription>
                  Legen Sie fest, wann Kunden Termine buchen können
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minNotice">Mindestvorlaufzeit (Stunden)</Label>
                    <Input
                      id="minNotice"
                      type="number"
                      min="0"
                      max="168"
                      value={bookingRules.minNoticeHours}
                      onChange={(e) =>
                        setBookingRules({
                          ...bookingRules,
                          minNoticeHours: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Wie viele Stunden im Voraus muss gebucht werden?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAdvance">Max. Vorausbuchung (Tage)</Label>
                    <Input
                      id="maxAdvance"
                      type="number"
                      min="1"
                      max="365"
                      value={bookingRules.maxAdvanceDays}
                      onChange={(e) =>
                        setBookingRules({
                          ...bookingRules,
                          maxAdvanceDays: parseInt(e.target.value) || 30,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Wie weit im Voraus können Termine gebucht werden?
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buffer">Pufferzeit zwischen Terminen (Min.)</Label>
                    <Input
                      id="buffer"
                      type="number"
                      min="0"
                      max="60"
                      step="5"
                      value={bookingRules.bufferMinutes}
                      onChange={(e) =>
                        setBookingRules({
                          ...bookingRules,
                          bufferMinutes: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Zeit zwischen zwei aufeinanderfolgenden Terminen
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Same-Day Buchungen</p>
                      <p className="text-sm text-muted-foreground">
                        Termine am selben Tag erlauben
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.allowSameDayBooking}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, allowSameDayBooking: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Telefonnummer erforderlich</p>
                      <p className="text-sm text-muted-foreground">
                        Kunden müssen eine Telefonnummer angeben
                      </p>
                    </div>
                    <Switch
                      checked={bookingRules.requirePhoneForBooking}
                      onCheckedChange={(checked) =>
                        setBookingRules({ ...bookingRules, requirePhoneForBooking: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Deposit Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Anzahlungen</CardTitle>
                <CardDescription>
                  Konfigurieren Sie Anzahlungen für Terminbuchungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Anzahlung aktivieren</p>
                    <p className="text-sm text-muted-foreground">
                      Kunden müssen bei der Buchung eine Anzahlung leisten
                    </p>
                  </div>
                  <Switch
                    checked={depositSettings.requireDeposit}
                    onCheckedChange={(checked) =>
                      setDepositSettings({ ...depositSettings, requireDeposit: checked })
                    }
                  />
                </div>

                {depositSettings.requireDeposit && (
                  <div className="grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label htmlFor="depositPercent">Anzahlung (%)</Label>
                      <Input
                        id="depositPercent"
                        type="number"
                        min="1"
                        max="100"
                        value={depositSettings.depositPercent}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            depositPercent: parseInt(e.target.value) || 20,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Prozentsatz des Terminpreises
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="depositMin">Mindestanzahlung (CHF)</Label>
                      <Input
                        id="depositMin"
                        type="number"
                        min="0"
                        step="0.5"
                        value={depositSettings.depositMinAmount / 100}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            depositMinAmount: Math.round(parseFloat(e.target.value) * 100) || 0,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Mindestbetrag für Anzahlung
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="refundHours">Rückerstattungsfrist (Stunden)</Label>
                      <Input
                        id="refundHours"
                        type="number"
                        min="0"
                        max="168"
                        value={depositSettings.refundableUntilHours}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            refundableUntilHours: parseInt(e.target.value) || 24,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Bis wie viele Stunden vor dem Termin ist eine vollständige Rückerstattung möglich?
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Services */}
        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leistungen</CardTitle>
                <CardDescription>
                  Verwalten Sie die angebotenen Dienstleistungen
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4">
                  <Switch
                    id="showInactive"
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <Label htmlFor="showInactive" className="text-sm">
                    Inaktive zeigen
                  </Label>
                </div>
                <Button onClick={openAddServiceDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Leistung
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-center">Dauer</TableHead>
                    <TableHead className="text-right">Preis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">
                          {showInactive
                            ? 'Keine Leistungen vorhanden'
                            : 'Keine aktiven Leistungen vorhanden'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((service) => (
                      <TableRow key={service.id} className={!service.isActive ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {service.categoryName && (
                            <Badge variant="secondary">{service.categoryName}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDuration(service.durationMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {service.priceFrom && 'ab '}
                          {formatCurrency(service.priceCents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={service.isActive ? 'default' : 'outline'}>
                              {service.isActive ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                            {service.isBookableOnline && service.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Online buchbar
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditServiceDialog(service)}
                              title="Bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {service.isActive ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(service)}
                                title="Deaktivieren"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestoreService(service)}
                                title="Reaktivieren"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <div className="space-y-6">
            {/* Stripe Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Zahlungseinstellungen</CardTitle>
                <CardDescription>
                  Konfigurieren Sie die Zahlungsmethoden
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <CreditCard className="h-8 w-8 text-primary" />
                    <div>
                      <h4 className="font-medium">Stripe</h4>
                      <p className="text-sm text-muted-foreground">
                        Kreditkarten und TWINT akzeptieren
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Verbunden</Badge>
                    <Button variant="outline" size="sm">
                      Konfigurieren
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Akzeptierte Zahlungsmethoden</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Kreditkarten (Visa, Mastercard, Amex)</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>TWINT</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Bezahlung vor Ort</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* VAT Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Mehrwertsteuer (MwSt)
                </CardTitle>
                <CardDescription>
                  Konfigurieren Sie die MwSt-Einstellungen für Rechnungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vatRate">MwSt-Satz (%)</Label>
                    <Input
                      id="vatRate"
                      type="number"
                      min="0"
                      max="25"
                      step="0.1"
                      value={vatSettings.vatRate}
                      onChange={(e) =>
                        setVatSettings({
                          ...vatSettings,
                          vatRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Schweizer Normalsatz: 8.1%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">MwSt-Nummer (UID)</Label>
                    <Input
                      id="vatNumber"
                      placeholder="CHE-123.456.789 MWST"
                      value={vatSettings.vatNumber}
                      onChange={(e) =>
                        setVatSettings({ ...vatSettings, vatNumber: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ihre Unternehmens-Identifikationsnummer
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">MwSt auf Rechnungen anzeigen</p>
                    <p className="text-sm text-muted-foreground">
                      MwSt-Betrag separat auf Rechnungen ausweisen
                    </p>
                  </div>
                  <Switch
                    checked={vatSettings.showVatOnInvoice}
                    onCheckedChange={(checked) =>
                      setVatSettings({ ...vatSettings, showVatOnInvoice: checked })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
              <CardDescription>
                Konfigurieren Sie automatische Benachrichtigungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Terminbestätigung</p>
                    <p className="text-sm text-muted-foreground">
                      E-Mail an Kunden nach Buchung
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Terminerinnerung</p>
                    <p className="text-sm text-muted-foreground">
                      24 Stunden vor dem Termin
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Bestellbestätigung</p>
                    <p className="text-sm text-muted-foreground">
                      E-Mail nach erfolgreicher Bestellung
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Versandbestätigung</p>
                    <p className="text-sm text-muted-foreground">
                      E-Mail bei Versand der Bestellung
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Service Add/Edit Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Leistung bearbeiten' : 'Neue Leistung'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Bearbeiten Sie die Details der Leistung'
                : 'Erstellen Sie eine neue Dienstleistung'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Name *</Label>
              <Input
                id="serviceName"
                value={serviceForm.name}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, name: e.target.value })
                }
                placeholder="z.B. Herrenschnitt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceCategory">Kategorie</Label>
              <Select
                value={serviceForm.categoryId}
                onValueChange={(value) =>
                  setServiceForm({ ...serviceForm, categoryId: value })
                }
              >
                <SelectTrigger id="serviceCategory">
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Kategorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceDuration">Dauer (Minuten) *</Label>
                <Input
                  id="serviceDuration"
                  type="number"
                  min="5"
                  step="5"
                  value={serviceForm.durationMinutes}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      durationMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="servicePrice">Preis (CHF) *</Label>
                <Input
                  id="servicePrice"
                  type="number"
                  min="0"
                  step="0.5"
                  value={serviceForm.priceCents / 100}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      priceCents: Math.round(parseFloat(e.target.value) * 100) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Beschreibung</Label>
              <Textarea
                id="serviceDescription"
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, description: e.target.value })
                }
                placeholder="Kurze Beschreibung der Leistung..."
                rows={3}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Preis ab</p>
                  <p className="text-xs text-muted-foreground">
                    Zeigt &quot;ab CHF X&quot; statt fester Preis
                  </p>
                </div>
                <Switch
                  checked={serviceForm.priceFrom}
                  onCheckedChange={(checked) =>
                    setServiceForm({ ...serviceForm, priceFrom: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Online buchbar</p>
                  <p className="text-xs text-muted-foreground">
                    Leistung im Buchungsportal anzeigen
                  </p>
                </div>
                <Switch
                  checked={serviceForm.isBookableOnline}
                  onCheckedChange={(checked) =>
                    setServiceForm({ ...serviceForm, isBookableOnline: checked })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setServiceDialogOpen(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSaveService} disabled={isSaving}>
              {isSaving ? 'Speichern...' : editingService ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leistung deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Leistung &quot;{serviceToDelete?.name}&quot; wird deaktiviert und nicht
              mehr auf der Website oder im Buchungsportal angezeigt. Sie können
              sie jederzeit wieder aktivieren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Deaktivieren...' : 'Deaktivieren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
