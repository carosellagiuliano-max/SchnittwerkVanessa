'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Sparkles, Lock, Mail, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserClient } from '@/lib/supabase/client';
import { MOCK_ADMIN_USER, MOCK_STAFF_USER } from '@/lib/mock/mock-data';

// ============================================
// MOCK MODE CHECK
// ============================================

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

// ============================================
// ADMIN LOGIN FORM
// ============================================

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // ========== MOCK MODE ==========
    if (isMockMode) {
      // Check mock credentials
      const isAdmin = email === MOCK_ADMIN_USER.email && password === MOCK_ADMIN_USER.password;
      const isStaff = email === MOCK_STAFF_USER.email && password === MOCK_STAFF_USER.password;

      if (isAdmin || isStaff) {
        // Store mock session in localStorage AND cookies (for server components)
        const mockUser = isAdmin ? MOCK_ADMIN_USER : MOCK_STAFF_USER;
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        localStorage.setItem('mock_session', 'true');

        // Set cookies for server-side auth check
        document.cookie = `mock_session=true; path=/; max-age=86400`;
        document.cookie = `mock_user=${encodeURIComponent(JSON.stringify(mockUser))}; path=/; max-age=86400`;

        // Small delay to simulate network
        await new Promise(resolve => setTimeout(resolve, 500));

        router.push('/admin');
        router.refresh();
        return;
      } else {
        setError('E-Mail oder Passwort ist ungueltig.');
        setIsLoading(false);
        return;
      }
    }

    // ========== REAL MODE (Supabase) ==========
    try {
      const supabase = createBrowserClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('E-Mail oder Passwort ist ungueltig.');
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if user is active staff
        const { data: staffMember } = await supabase
          .from('staff')
          .select('id, display_name')
          .eq('profile_id', data.user.id)
          .eq('is_active', true)
          .single();

        if (!staffMember) {
          // Allow admin user even without staff entry (for initial setup)
          const isAdmin = data.user.user_metadata?.role === 'admin' ||
                          data.user.email === 'admin@schnittwerk.ch';

          if (!isAdmin) {
            await supabase.auth.signOut();
            setError('Sie haben keine Berechtigung fuer den Admin-Bereich.');
            setIsLoading(false);
            return;
          }
        }

        // Redirect to admin dashboard
        router.push('/admin');
        router.refresh();
      }
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo/Brand */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-glow-sm">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-gradient-primary mb-2">SCHNITTWERK</h1>
        <p className="text-muted-foreground">Admin-Bereich</p>
      </div>

      {/* Login Card */}
      <div className="card-elegant p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-fade-in">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">E-Mail</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <Input
                id="email"
                type="email"
                placeholder="name@salon.ch"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
                className="pl-10 h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Passwort</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ihr Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="pl-10 pr-12 h-12 rounded-xl bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                tabIndex={-1}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 rounded-xl btn-glow text-base font-medium shadow-glow-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Anmelden...
              </>
            ) : (
              'Anmelden'
            )}
          </Button>

          {/* Mock Mode Hint */}
          {isMockMode && (
            <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-fade-in">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-700 dark:text-amber-300 mb-2">Demo-Modus aktiv</p>
                  <div className="space-y-1 text-amber-600 dark:text-amber-400">
                    <p className="font-mono">Admin: admin@schnittwerk.ch / admin123</p>
                    <p className="font-mono">Staff: vanessa@schnittwerk.ch / staff123</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        Geschuetzt durch sichere Verschluesselung
      </p>
    </div>
  );
}
