import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

export type StaffRole = 'admin' | 'manager' | 'hq' | 'staff';

export interface StaffMember {
  id: string;
  role: StaffRole;
  salon_id: string;
  display_name: string;
}

// ============================================
// ROLE HIERARCHY
// ============================================

const roleHierarchy: Record<StaffRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
  hq: 4,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if user has required role (or higher)
 */
export function hasRequiredRole(userRole: StaffRole, requiredRole: StaffRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user has one of the allowed roles
 */
export function hasAllowedRole(userRole: StaffRole, allowedRoles: StaffRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Get current staff member from session
 * Returns null if not authenticated or not a staff member
 */
export async function getCurrentStaffMember(): Promise<StaffMember | null> {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, role, salon_id, display_name')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  return staffMember as StaffMember | null;
}

/**
 * Require authentication and redirect if not logged in
 */
export async function requireAuth(): Promise<StaffMember> {
  const staffMember = await getCurrentStaffMember();

  if (!staffMember) {
    redirect('/admin/login');
  }

  return staffMember;
}

/**
 * Require specific roles for page access
 * Redirects to dashboard if not authorized
 */
export async function requireRoles(allowedRoles: StaffRole[]): Promise<StaffMember> {
  const staffMember = await requireAuth();

  if (!hasAllowedRole(staffMember.role, allowedRoles)) {
    redirect('/admin?error=unauthorized');
  }

  return staffMember;
}

/**
 * Require minimum role level
 * Redirects to dashboard if role level is insufficient
 */
export async function requireMinimumRole(minimumRole: StaffRole): Promise<StaffMember> {
  const staffMember = await requireAuth();

  if (!hasRequiredRole(staffMember.role, minimumRole)) {
    redirect('/admin?error=unauthorized');
  }

  return staffMember;
}

// ============================================
// PAGE-LEVEL RBAC HELPERS
// ============================================

/**
 * Protect admin-only pages
 */
export async function protectAdminPage(): Promise<StaffMember> {
  return requireRoles(['admin', 'hq']);
}

/**
 * Protect manager-level pages
 */
export async function protectManagerPage(): Promise<StaffMember> {
  return requireRoles(['admin', 'manager', 'hq']);
}

/**
 * Protect staff-level pages (any authenticated staff)
 */
export async function protectStaffPage(): Promise<StaffMember> {
  return requireRoles(['admin', 'manager', 'hq', 'staff']);
}

// ============================================
// API-LEVEL RBAC HELPERS
// ============================================

/**
 * Get staff member for API routes
 * Returns null if not authenticated
 */
export async function getStaffMemberForAPI(): Promise<StaffMember | null> {
  return getCurrentStaffMember();
}

/**
 * Check if API caller has required roles
 */
export async function checkAPIRoles(allowedRoles: StaffRole[]): Promise<{
  authorized: boolean;
  staffMember: StaffMember | null;
  error?: string;
}> {
  const staffMember = await getCurrentStaffMember();

  if (!staffMember) {
    return {
      authorized: false,
      staffMember: null,
      error: 'Nicht autorisiert',
    };
  }

  if (!hasAllowedRole(staffMember.role, allowedRoles)) {
    return {
      authorized: false,
      staffMember,
      error: 'Keine Berechtigung für diese Aktion',
    };
  }

  return {
    authorized: true,
    staffMember,
  };
}
