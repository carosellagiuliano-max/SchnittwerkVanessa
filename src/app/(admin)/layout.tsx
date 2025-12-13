import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { Toaster } from '@/components/ui/sonner';
import { isMockMode, getMockUser, getMockStaffMember } from '@/lib/mock/mock-auth';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: {
    default: 'Admin | SCHNITTWERK',
    template: '%s | Admin | SCHNITTWERK',
  },
  robots: { index: false, follow: false },
};

// ============================================
// ADMIN LAYOUT
// ============================================

// Types
interface StaffMemberRow {
  id: string;
  display_name: string | null;
  salon_id: string;
  job_title: string | null;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ========== MOCK MODE ==========
  if (isMockMode()) {
    const mockUser = await getMockUser();

    if (!mockUser) {
      redirect('/admin/login');
    }

    const mockStaff = await getMockStaffMember(mockUser.id);

    if (!mockStaff) {
      redirect('/admin/login?error=unauthorized');
    }

    return (
      <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Mock Mode Banner */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 text-center text-xs py-1.5 font-medium tracking-wide shadow-sm">
          DEMO-MODUS - Keine echte Datenbank verbunden
        </div>

        {/* Sidebar */}
        <AdminSidebar
          user={{
            name: mockStaff.display_name,
            email: mockUser.email,
            role: mockStaff.role,
          }}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden pt-6">
          {/* Header */}
          <AdminHeader
            user={{
              name: mockStaff.display_name,
              email: mockUser.email,
              role: mockStaff.role,
            }}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'bg-card/95 backdrop-blur-xl border-border/50 shadow-elegant',
              title: 'text-foreground font-medium',
              description: 'text-muted-foreground',
              success: 'border-l-4 border-l-emerald-500',
              error: 'border-l-4 border-l-destructive',
              warning: 'border-l-4 border-l-amber-500',
              info: 'border-l-4 border-l-primary',
            },
          }}
        />
      </div>
    );
  }

  // ========== REAL MODE (Supabase) ==========
  // Check authentication
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Check if user is active staff member or admin
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, display_name, salon_id, job_title')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single() as { data: StaffMemberRow | null };

  // Allow admin email even without staff entry
  const isAdminEmail = user.email === 'admin@schnittwerk.ch';

  if (!staffMember && !isAdminEmail) {
    redirect('/admin/login?error=unauthorized');
  }

  // Determine role based on job_title or admin status
  const userRole = isAdminEmail ? 'admin' : (staffMember?.job_title?.toLowerCase().includes('admin') ? 'admin' : 'staff');

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Subtle decorative background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-radial from-primary/3 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-gradient-radial from-rose/3 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Sidebar */}
      <AdminSidebar
        user={{
          name: staffMember?.display_name || user.email || 'Admin',
          email: user.email || '',
          role: userRole,
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AdminHeader
          user={{
            name: staffMember?.display_name || user.email || 'Admin',
            email: user.email || '',
            role: userRole,
          }}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-card/95 backdrop-blur-xl border-border/50 shadow-elegant',
            title: 'text-foreground font-medium',
            description: 'text-muted-foreground',
            success: 'border-l-4 border-l-emerald-500',
            error: 'border-l-4 border-l-destructive',
            warning: 'border-l-4 border-l-amber-500',
            info: 'border-l-4 border-l-primary',
          },
        }}
      />
    </div>
  );
}
