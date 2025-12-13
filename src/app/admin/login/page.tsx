import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { AdminLoginForm } from '@/components/admin/admin-login-form';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Admin Login | SCHNITTWERK',
  robots: { index: false, follow: false },
};

// ============================================
// ADMIN LOGIN PAGE
// ============================================

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  // Check if already authenticated
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if user is active admin/staff
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, display_name')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    // Allow if active staff member or admin email
    if (staffMember || user.email === 'admin@schnittwerk.ch') {
      redirect('/admin');
    }
  }

  const params = await searchParams;
  const error = params.error;
  const message = params.message;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-beauty p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-primary/8 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-radial from-rose/8 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary/3 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="w-full max-w-md animate-fade-in">
        {/* Error Messages */}
        {error === 'unauthorized' && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-slide-up">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">Sie haben keine Berechtigung fuer den Admin-Bereich.</p>
          </div>
        )}
        {error === 'invalid_credentials' && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-slide-up">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">E-Mail oder Passwort ist ungueltig.</p>
          </div>
        )}
        {message && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary animate-slide-up">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{message}</p>
          </div>
        )}

        {/* Login Form */}
        <AdminLoginForm />

        {/* Back to Website */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Zurueck zur Website
          </Link>
        </div>
      </div>
    </div>
  );
}
