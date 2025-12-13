import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { AdminTeamView } from '@/components/admin/admin-team-view';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Team & Mitarbeiter',
};

// ============================================
// TYPES
// ============================================

interface StaffSkill {
  staff_id: string;
  service_id: string;
  skill_level: number | null;
}

interface WorkingHour {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ============================================
// DATA FETCHING
// ============================================

async function getTeamData() {
  const supabase = await createServerClient();

  // Fetch staff members
  const { data: staffData, error } = await supabase
    .from('staff')
    .select(
      `
      id,
      salon_id,
      profile_id,
      display_name,
      email,
      phone,
      role,
      color,
      is_active,
      created_at,
      default_schedule,
      employment_type,
      hire_date,
      bio,
      specializations
    `
    )
    .order('display_name');

  if (error) {
    console.error('Error fetching staff:', error);
    return { staff: [], services: [], absences: [], skills: [] as StaffSkill[], workingHours: [] as WorkingHour[] };
  }

  // Fetch services for skills
  const { data: servicesData } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('is_active', true)
    .order('name');

  // Fetch upcoming absences
  const { data: absencesData } = await supabase
    .from('staff_absences')
    .select('*')
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('start_date');

  // Fetch staff skills
  const { data: skillsData } = await supabase
    .from('staff_service_skills')
    .select('staff_id, service_id, skill_level') as { data: StaffSkill[] | null };

  // Fetch working hours
  const { data: workingHoursData } = await supabase
    .from('staff_working_hours')
    .select('*') as { data: WorkingHour[] | null };

  return {
    staff: staffData || [],
    services: servicesData || [],
    absences: absencesData || [],
    skills: (skillsData || []) as StaffSkill[],
    workingHours: (workingHoursData || []) as WorkingHour[],
  };
}

// ============================================
// ADMIN TEAM PAGE
// ============================================

export default async function AdminTeamPage() {
  const { staff, services, absences, skills, workingHours } = await getTeamData();

  return (
    <AdminTeamView
      staff={staff}
      services={services}
      absences={absences}
      skills={skills}
      workingHours={workingHours}
    />
  );
}
