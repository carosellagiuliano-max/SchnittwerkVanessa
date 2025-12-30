'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  Clock,
  Shield,
  Briefcase,
  Award,
  CalendarOff,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface StaffMember {
  id: string;
  salon_id: string;
  profile_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
  default_schedule: Record<string, unknown> | null;
  employment_type: string | null;
  hire_date: string | null;
  bio: string | null;
  specializations: string[] | null;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

interface Absence {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  notes: string | null;
}

interface StaffSkill {
  staff_id: string;
  service_id: string;
  skill_level: number | null;
}

// Mapping between numeric skill_level (DB) and string proficiency (UI)
const skillLevelToString = (level: number | null): string => {
  if (level === null) return '';
  if (level <= 2) return 'beginner';
  if (level === 3) return 'standard';
  return 'expert';
};

const stringToSkillLevel = (str: string): number | null => {
  if (str === 'beginner') return 1;
  if (str === 'standard') return 3;
  if (str === 'expert') return 5;
  return null;
};

interface WorkingHour {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface AdminTeamViewProps {
  staff: StaffMember[];
  services: Service[];
  absences: Absence[];
  skills: StaffSkill[];
  workingHours: WorkingHour[];
}

// ============================================
// CONSTANTS
// ============================================

const roleConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  admin: { label: 'Administrator', variant: 'default' },
  manager: { label: 'Manager', variant: 'default' },
  staff: { label: 'Mitarbeiter', variant: 'secondary' },
  hq: { label: 'Hauptverwaltung', variant: 'outline' },
};

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const shortDayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const absenceTypes: Record<string, { label: string; color: string }> = {
  vacation: { label: 'Urlaub', color: 'bg-blue-500' },
  sick: { label: 'Krankheit', color: 'bg-red-500' },
  personal: { label: 'Persönlich', color: 'bg-yellow-500' },
  training: { label: 'Weiterbildung', color: 'bg-purple-500' },
  other: { label: 'Sonstiges', color: 'bg-gray-500' },
};

const proficiencyLevels: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Anfänger', color: 'bg-yellow-500' },
  standard: { label: 'Standard', color: 'bg-blue-500' },
  expert: { label: 'Experte', color: 'bg-green-500' },
};

// ============================================
// HELPERS
// ============================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================
// ADMIN TEAM VIEW
// ============================================

export function AdminTeamView({
  staff,
  services,
  absences,
  skills,
  workingHours,
}: AdminTeamViewProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  // Working Hours Dialog
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false);
  const [editingHours, setEditingHours] = useState<Record<number, { start: string; end: string; active: boolean }>>({});

  // Skills Dialog
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [editingSkills, setEditingSkills] = useState<Record<string, boolean>>({});

  // Absence Dialog
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [newAbsence, setNewAbsence] = useState({
    startDate: '',
    endDate: '',
    type: 'vacation',
    notes: '',
  });

  // Add Staff Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    display_name: '',
    email: '',
    phone: '',
    role: 'staff',
    color: '#3b82f6',
    employment_type: 'full_time',
  });

  // Edit Staff Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState({
    display_name: '',
    email: '',
    phone: '',
    role: 'staff',
    color: '#3b82f6',
    employment_type: 'full_time',
  });

  const [isSaving, setIsSaving] = useState(false);

  const activeStaff = staff.filter((s) => s.is_active);
  const inactiveStaff = staff.filter((s) => !s.is_active);

  // Get skills for a staff member
  const getStaffSkills = (staffId: string) => {
    return skills.filter((s) => s.staff_id === staffId);
  };

  // Get working hours for a staff member
  const getStaffWorkingHours = (staffId: string) => {
    return workingHours.filter((h) => h.staff_id === staffId);
  };

  // Get absences for a staff member
  const getStaffAbsences = (staffId: string) => {
    return absences.filter((a) => a.staff_id === staffId);
  };

  // Open hours dialog
  const openHoursDialog = (member: StaffMember) => {
    setSelectedMember(member);
    const staffHours = getStaffWorkingHours(member.id);
    const hoursMap: Record<number, { start: string; end: string; active: boolean }> = {};

    // Initialize all days
    for (let i = 0; i < 7; i++) {
      const dayHour = staffHours.find((h) => h.day_of_week === i);
      hoursMap[i] = dayHour
        ? { start: dayHour.start_time.slice(0, 5), end: dayHour.end_time.slice(0, 5), active: dayHour.is_active }
        : { start: '09:00', end: '18:00', active: false };
    }

    setEditingHours(hoursMap);
    setHoursDialogOpen(true);
  };

  // Save working hours
  const handleSaveHours = async () => {
    if (!selectedMember) return;
    setIsSaving(true);
    const supabase = createBrowserClient();

    try {
      // Delete existing hours
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase
        .from('staff_working_hours') as any)
        .delete()
        .eq('staff_id', selectedMember.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        toast.error('Fehler beim Löschen der alten Arbeitszeiten');
        setIsSaving(false);
        return;
      }

      // Insert new hours
      const hoursToInsert = Object.entries(editingHours)
        .filter(([_, hours]) => hours.active)
        .map(([day, hours]) => ({
          staff_id: selectedMember.id,
          day_of_week: parseInt(day),
          start_time: hours.start,
          end_time: hours.end,
          is_active: true,
        }));

      if (hoursToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase
          .from('staff_working_hours') as any)
          .insert(hoursToInsert);

        if (insertError) {
          console.error('Insert error:', insertError);
          toast.error('Fehler beim Speichern der Arbeitszeiten');
          setIsSaving(false);
          return;
        }
      }

      toast.success('Arbeitszeiten gespeichert');
      setHoursDialogOpen(false);
      router.refresh();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Unerwarteter Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  // Open skills dialog (now called "Leistungen zuordnen")
  const openSkillsDialog = (member: StaffMember) => {
    setSelectedMember(member);
    const staffSkills = getStaffSkills(member.id);
    const skillsMap: Record<string, boolean> = {};

    services.forEach((service) => {
      const skill = staffSkills.find((s) => s.service_id === service.id);
      skillsMap[service.id] = !!skill; // true if assigned, false otherwise
    });

    setEditingSkills(skillsMap);
    setSkillsDialogOpen(true);
  };

  // Save service assignments
  const handleSaveSkills = async () => {
    if (!selectedMember) return;
    setIsSaving(true);
    const supabase = createBrowserClient();

    // Delete existing service assignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('staff_service_skills') as any).delete().eq('staff_id', selectedMember.id);

    // Insert new service assignments (only where checked = true)
    const skillsToInsert = Object.entries(editingSkills)
      .filter(([_, isAssigned]) => isAssigned)
      .map(([serviceId]) => ({
        staff_id: selectedMember.id,
        service_id: serviceId,
        skill_level: 3, // Default skill level
      }));

    if (skillsToInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('staff_service_skills') as any).insert(skillsToInsert);
      if (error) {
        console.error('Error saving service assignments:', error);
        toast.error('Fehler beim Speichern der Leistungen');
        setIsSaving(false);
        return;
      }
    }

    toast.success('Leistungen zugeordnet');
    setSkillsDialogOpen(false);
    router.refresh();
    setIsSaving(false);
  };

  // Open absence dialog
  const openAbsenceDialog = (member: StaffMember) => {
    setSelectedMember(member);
    setNewAbsence({
      startDate: '',
      endDate: '',
      type: 'vacation',
      notes: '',
    });
    setAbsenceDialogOpen(true);
  };

  // Save absence
  const handleSaveAbsence = async () => {
    if (!selectedMember || !newAbsence.startDate || !newAbsence.endDate) {
      toast.error('Bitte Start- und Enddatum angeben');
      return;
    }

    setIsSaving(true);
    const supabase = createBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff_absences') as any).insert({
      salon_id: selectedMember.salon_id,
      staff_id: selectedMember.id,
      start_date: newAbsence.startDate,
      end_date: newAbsence.endDate,
      absence_type: newAbsence.type,
      notes: newAbsence.notes || null,
      status: 'approved',
    });

    if (error) {
      toast.error('Fehler beim Speichern der Abwesenheit');
    } else {
      toast.success('Abwesenheit gespeichert');
      setAbsenceDialogOpen(false);
      router.refresh();
    }

    setIsSaving(false);
  };

  const handleDeleteClick = (member: StaffMember) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMember) return;
    const supabase = createBrowserClient();

    // Deactivate staff and make them non-bookable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff') as any)
      .update({
        is_active: false,
        is_bookable: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedMember.id);

    if (error) {
      console.error('Deactivate error:', error);
      toast.error('Fehler beim Deaktivieren');
    } else {
      toast.success('Mitarbeiter deaktiviert');
      // Invalidate caches
      try {
        const res1 = await fetch('/api/revalidate?tag=booking', { method: 'POST' });
        console.log('Revalidate booking:', res1.status);
        const res2 = await fetch('/api/revalidate?tag=staff', { method: 'POST' });
        console.log('Revalidate staff:', res2.status);
      } catch (e) {
        console.error('Revalidation error:', e);
      }
      router.refresh();
    }

    setDeleteDialogOpen(false);
    setSelectedMember(null);
  };

  const handleActivate = async (member: StaffMember) => {
    const supabase = createBrowserClient();

    // Reactivate staff and make them bookable again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff') as any)
      .update({
        is_active: true,
        is_bookable: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', member.id);

    if (error) {
      toast.error('Fehler beim Aktivieren');
    } else {
      toast.success('Mitarbeiter aktiviert');
      // Invalidate caches
      fetch('/api/revalidate?tag=booking', { method: 'POST' }).catch(() => {});
      fetch('/api/revalidate?tag=staff', { method: 'POST' }).catch(() => {});
      router.refresh();
    }
  };

  // Open edit dialog
  const openEditDialog = (member: StaffMember) => {
    setSelectedMember(member);
    setEditingStaff({
      display_name: member.display_name,
      email: member.email || '',
      phone: member.phone || '',
      role: member.role,
      color: member.color || '#3b82f6',
      employment_type: member.employment_type || 'full_time',
    });
    setEditDialogOpen(true);
  };

  // Save edited staff member
  const handleEditStaff = async () => {
    if (!selectedMember) return;
    if (!editingStaff.display_name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSaving(true);
    const supabase = createBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff') as any)
      .update({
        display_name: editingStaff.display_name.trim(),
        email: editingStaff.email.trim() || null,
        phone: editingStaff.phone.trim() || null,
        role: editingStaff.role,
        color: editingStaff.color,
        employment_type: editingStaff.employment_type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedMember.id);

    if (error) {
      console.error('Error updating staff:', error);
      toast.error('Fehler beim Aktualisieren des Mitarbeiters');
    } else {
      toast.success('Mitarbeiter aktualisiert');
      setEditDialogOpen(false);
      // Invalidate caches
      fetch('/api/revalidate?tag=booking', { method: 'POST' }).catch(() => {});
      fetch('/api/revalidate?tag=staff', { method: 'POST' }).catch(() => {});
      router.refresh();
    }

    setIsSaving(false);
  };

  // Add new staff member
  const handleAddStaff = async () => {
    if (!newStaff.display_name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    // Get salon_id from existing staff or use default
    const existingStaff = staff[0];
    const salonId = existingStaff?.salon_id || '550e8400-e29b-41d4-a716-446655440001';

    // Calculate next sort_order
    const maxSortOrder = Math.max(...staff.map(s => (s as StaffMember & { sort_order?: number }).sort_order || 0), 0);

    setIsSaving(true);
    const supabase = createBrowserClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff') as any).insert({
      salon_id: salonId,
      display_name: newStaff.display_name.trim(),
      email: newStaff.email.trim() || null,
      phone: newStaff.phone.trim() || null,
      role: newStaff.role,
      color: newStaff.color,
      employment_type: newStaff.employment_type,
      is_active: true,
      is_bookable: true,
      sort_order: maxSortOrder + 1,
    });

    if (error) {
      console.error('Error adding staff:', error);
      toast.error('Fehler beim Hinzufügen des Mitarbeiters');
    } else {
      toast.success('Mitarbeiter hinzugefügt');
      setAddDialogOpen(false);
      setNewStaff({
        display_name: '',
        email: '',
        phone: '',
        role: 'staff',
        color: '#3b82f6',
        employment_type: 'full_time',
      });
      // Invalidate caches so new staff appears everywhere
      fetch('/api/revalidate?tag=booking', { method: 'POST' }).catch(() => {});
      fetch('/api/revalidate?tag=staff', { method: 'POST' }).catch(() => {});
      router.refresh();
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {activeStaff.length} aktive Mitarbeiter
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Mitarbeiter hinzufügen
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="absences">Abwesenheiten ({absences.length})</TabsTrigger>
          <TabsTrigger value="skills">Leistungen</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Active Staff */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeStaff.map((member) => {
              const role = roleConfig[member.role] || {
                label: member.role,
                variant: 'secondary' as const,
              };
              const memberSkills = getStaffSkills(member.id);
              const memberHours = getStaffWorkingHours(member.id);

              return (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar
                          className="h-12 w-12"
                          style={{
                            backgroundColor: member.color || 'hsl(var(--primary))',
                          }}
                        >
                          <AvatarFallback
                            className="text-white"
                            style={{
                              backgroundColor: member.color || 'hsl(var(--primary))',
                            }}
                          >
                            {getInitials(member.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{member.display_name}</h3>
                          <Badge variant={role.variant} className="mt-1">
                            <Shield className="h-3 w-3 mr-1" />
                            {role.label}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(member)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openHoursDialog(member)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Arbeitszeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSkillsDialog(member)}>
                            <Award className="h-4 w-4 mr-2" />
                            Leistungen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAbsenceDialog(member)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Abwesenheit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(member)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deaktivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-4 w-4" />
                          {member.email}
                        </a>
                      )}
                      {member.phone && (
                        <a
                          href={`tel:${member.phone}`}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-4 w-4" />
                          {member.phone}
                        </a>
                      )}
                    </div>

                    {/* Quick info */}
                    <div className="mt-4 pt-4 border-t flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {memberHours.filter((h) => h.is_active).length} Tage
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        {memberSkills.length} Skills
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Inactive Staff */}
          {inactiveStaff.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium text-muted-foreground">
                Inaktive Mitarbeiter ({inactiveStaff.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactiveStaff.map((member) => (
                  <Card key={member.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 bg-muted">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {getInitials(member.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium text-muted-foreground">
                              {member.display_name}
                            </h3>
                            <Badge variant="outline" className="mt-1">
                              Inaktiv
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(member)}
                        >
                          Aktivieren
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Absences Tab */}
        <TabsContent value="absences">
          <Card>
            <CardHeader>
              <CardTitle>Abwesenheiten</CardTitle>
            </CardHeader>
            <CardContent>
              {absences.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Keine geplanten Abwesenheiten
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitarbeiter</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Von</TableHead>
                      <TableHead>Bis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notizen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absences.map((absence) => {
                      const staffMember = staff.find((s) => s.id === absence.staff_id);
                      const type = absenceTypes[absence.absence_type] || { label: absence.absence_type, color: 'bg-gray-500' };
                      return (
                        <TableRow key={absence.id}>
                          <TableCell className="font-medium">
                            {staffMember?.display_name || 'Unbekannt'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${type.color} text-white`}>
                              {type.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(absence.start_date)}</TableCell>
                          <TableCell>{formatDate(absence.end_date)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={absence.status === 'approved' ? 'default' : 'secondary'}
                            >
                              {absence.status === 'approved' ? 'Genehmigt' : 'Ausstehend'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {absence.notes || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leistungs-Übersicht Tab */}
        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Leistungs-Übersicht</CardTitle>
              <p className="text-sm text-muted-foreground">
                Übersicht welche Mitarbeiter welche Leistungen ausführen können
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Mitarbeiter</TableHead>
                      {services.map((service) => (
                        <TableHead key={service.id} className="text-center min-w-[100px]">
                          {service.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeStaff.map((member) => {
                      const memberSkills = getStaffSkills(member.id);
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {member.display_name}
                          </TableCell>
                          {services.map((service) => {
                            const isAssigned = memberSkills.some((s) => s.service_id === service.id);
                            return (
                              <TableCell key={service.id} className="text-center">
                                {isAssigned ? (
                                  <Badge variant="default" className="bg-green-500 text-white">
                                    ✓
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitarbeiter deaktivieren</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie {selectedMember?.display_name} deaktivieren
              möchten? Der Mitarbeiter hat keinen Zugriff mehr auf das System.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Working Hours Dialog */}
      <Dialog open={hoursDialogOpen} onOpenChange={setHoursDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Arbeitszeiten - {selectedMember?.display_name}</DialogTitle>
            <DialogDescription>
              Definieren Sie die regelmässigen Arbeitszeiten
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-24">
                  <Checkbox
                    id={`day-${day}`}
                    checked={editingHours[day]?.active || false}
                    onCheckedChange={(checked) =>
                      setEditingHours({
                        ...editingHours,
                        [day]: { ...editingHours[day], active: checked === true },
                      })
                    }
                  />
                  <Label htmlFor={`day-${day}`} className="ml-2">
                    {dayNames[day]}
                  </Label>
                </div>
                {editingHours[day]?.active && (
                  <>
                    <Input
                      type="time"
                      value={editingHours[day]?.start || '09:00'}
                      onChange={(e) =>
                        setEditingHours({
                          ...editingHours,
                          [day]: { ...editingHours[day], start: e.target.value },
                        })
                      }
                      className="w-32"
                    />
                    <span>bis</span>
                    <Input
                      type="time"
                      value={editingHours[day]?.end || '18:00'}
                      onChange={(e) =>
                        setEditingHours({
                          ...editingHours,
                          [day]: { ...editingHours[day], end: e.target.value },
                        })
                      }
                      className="w-32"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoursDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveHours} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leistungen zuordnen Dialog */}
      <Dialog open={skillsDialogOpen} onOpenChange={setSkillsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Leistungen zuordnen - {selectedMember?.display_name}</DialogTitle>
            <DialogDescription>
              Wählen Sie die Leistungen, die dieser Mitarbeiter ausführen kann
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {services.map((service) => (
              <div key={service.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={editingSkills[service.id] || false}
                  onCheckedChange={(checked) =>
                    setEditingSkills({ ...editingSkills, [service.id]: !!checked })
                  }
                />
                <label
                  htmlFor={`service-${service.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <span className="font-medium">{service.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({service.duration_minutes} Min.)
                  </span>
                </label>
              </div>
            ))}
            {services.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Keine Leistungen vorhanden. Fügen Sie zuerst Leistungen unter Einstellungen hinzu.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveSkills} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abwesenheit - {selectedMember?.display_name}</DialogTitle>
            <DialogDescription>
              Erfassen Sie eine neue Abwesenheit
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="absenceType">Art der Abwesenheit</Label>
              <Select
                value={newAbsence.type}
                onValueChange={(value) =>
                  setNewAbsence({ ...newAbsence, type: value })
                }
              >
                <SelectTrigger id="absenceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Urlaub</SelectItem>
                  <SelectItem value="sick">Krankheit</SelectItem>
                  <SelectItem value="personal">Persönlich</SelectItem>
                  <SelectItem value="training">Weiterbildung</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Von</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newAbsence.startDate}
                  onChange={(e) =>
                    setNewAbsence({ ...newAbsence, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Bis</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newAbsence.endDate}
                  onChange={(e) =>
                    setNewAbsence({ ...newAbsence, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen (optional)</Label>
              <Input
                id="notes"
                value={newAbsence.notes}
                onChange={(e) =>
                  setNewAbsence({ ...newAbsence, notes: e.target.value })
                }
                placeholder="z.B. Grund, Vertretung..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveAbsence} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Mitarbeiter hinzufügen</DialogTitle>
            <DialogDescription>
              Erfassen Sie die Daten des neuen Mitarbeiters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staffName">Name *</Label>
              <Input
                id="staffName"
                value={newStaff.display_name}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, display_name: e.target.value })
                }
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffEmail">E-Mail</Label>
              <Input
                id="staffEmail"
                type="email"
                value={newStaff.email}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, email: e.target.value })
                }
                placeholder="email@beispiel.ch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffPhone">Telefon</Label>
              <Input
                id="staffPhone"
                type="tel"
                value={newStaff.phone}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, phone: e.target.value })
                }
                placeholder="+41 79 123 45 67"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffRole">Rolle</Label>
                <Select
                  value={newStaff.role}
                  onValueChange={(value) =>
                    setNewStaff({ ...newStaff, role: value })
                  }
                >
                  <SelectTrigger id="staffRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Mitarbeiter</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffEmployment">Anstellung</Label>
                <Select
                  value={newStaff.employment_type}
                  onValueChange={(value) =>
                    setNewStaff({ ...newStaff, employment_type: value })
                  }
                >
                  <SelectTrigger id="staffEmployment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Vollzeit</SelectItem>
                    <SelectItem value="part_time">Teilzeit</SelectItem>
                    <SelectItem value="contractor">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staffColor">Farbe (für Kalender)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="staffColor"
                  type="color"
                  value={newStaff.color}
                  onChange={(e) =>
                    setNewStaff({ ...newStaff, color: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{newStaff.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddStaff} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Daten des Mitarbeiters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editStaffName">Name *</Label>
              <Input
                id="editStaffName"
                value={editingStaff.display_name}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, display_name: e.target.value })
                }
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStaffEmail">E-Mail</Label>
              <Input
                id="editStaffEmail"
                type="email"
                value={editingStaff.email}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, email: e.target.value })
                }
                placeholder="email@beispiel.ch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStaffPhone">Telefon</Label>
              <Input
                id="editStaffPhone"
                type="tel"
                value={editingStaff.phone}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, phone: e.target.value })
                }
                placeholder="+41 79 123 45 67"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStaffRole">Rolle</Label>
                <Select
                  value={editingStaff.role}
                  onValueChange={(value) =>
                    setEditingStaff({ ...editingStaff, role: value })
                  }
                >
                  <SelectTrigger id="editStaffRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Mitarbeiter</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStaffEmployment">Anstellung</Label>
                <Select
                  value={editingStaff.employment_type}
                  onValueChange={(value) =>
                    setEditingStaff({ ...editingStaff, employment_type: value })
                  }
                >
                  <SelectTrigger id="editStaffEmployment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Vollzeit</SelectItem>
                    <SelectItem value="part_time">Teilzeit</SelectItem>
                    <SelectItem value="contractor">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStaffColor">Farbe (für Kalender)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="editStaffColor"
                  type="color"
                  value={editingStaff.color}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, color: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{editingStaff.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditStaff} disabled={isSaving}>
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
