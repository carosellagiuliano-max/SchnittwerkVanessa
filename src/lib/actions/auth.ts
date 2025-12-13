'use server';

import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// AUTH SERVER ACTIONS
// ============================================

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

// ============================================
// REGISTER CUSTOMER
// ============================================

export type RegisterResult = {
  success: boolean;
  error?: string;
  userId?: string;
};

export async function registerCustomer(formData: FormData): Promise<RegisterResult> {
  const supabase = await createServerClient();

  try {
    // Validate input
    const validatedFields = registerSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validierungsfehler';
      return { success: false, error: firstError };
    }

    const { email, password, firstName, lastName, phone } = validatedFields.data;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/konto/verifiziert`,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
      }
      return { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }

    if (!authData.user) {
      return { success: false, error: 'Benutzer konnte nicht erstellt werden.' };
    }

    // Create profile (should be handled by trigger, but ensure it exists)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
    });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Don't fail - profile might be created by trigger
    }

    // Assign customer role
    const { error: roleError } = await supabase.from('user_roles').insert({
      profile_id: authData.user.id,
      salon_id: DEFAULT_SALON_ID,
      role_name: 'kunde',
    });

    if (roleError) {
      console.error('Role error:', roleError);
      // Don't fail - might already exist
    }

    return {
      success: true,
      userId: authData.user.id,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// LOGIN
// ============================================

export type LoginResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
};

export async function loginCustomer(formData: FormData): Promise<LoginResult> {
  const supabase = await createServerClient();

  try {
    const validatedFields = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validierungsfehler';
      return { success: false, error: firstError };
    }

    const { email, password } = validatedFields.data;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'E-Mail oder Passwort ist falsch.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.' };
      }
      return { success: false, error: 'Anmeldung fehlgeschlagen.' };
    }

    if (!data.user) {
      return { success: false, error: 'Anmeldung fehlgeschlagen.' };
    }

    // Get user roles to determine redirect
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('profile_id', data.user.id);

    const roleNames = roles?.map((r) => r.role_name) || [];

    // Determine redirect based on role
    let redirectTo = '/konto';
    if (roleNames.includes('admin') || roleNames.includes('manager')) {
      redirectTo = '/admin';
    } else if (roleNames.includes('mitarbeiter')) {
      redirectTo = '/admin/kalender';
    }

    return {
      success: true,
      redirectTo,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// PASSWORD RESET REQUEST
// ============================================

export type PasswordResetResult = {
  success: boolean;
  error?: string;
};

export async function requestPasswordReset(formData: FormData): Promise<PasswordResetResult> {
  const supabase = await createServerClient();

  try {
    const email = formData.get('email') as string;

    if (!email || !z.string().email().safeParse(email).success) {
      return { success: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/konto/passwort-aendern`,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Don't reveal if email exists or not
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: true }; // Still return success
  }
}

// ============================================
// UPDATE PASSWORD
// ============================================

export async function updatePassword(formData: FormData): Promise<PasswordResetResult> {
  const supabase = await createServerClient();

  try {
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!password || password.length < 8) {
      return { success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Passwörter stimmen nicht überein.' };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error('Update password error:', error);
      return { success: false, error: 'Passwort konnte nicht geändert werden.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

// ============================================
// GET CURRENT USER
// ============================================

export async function getCurrentUser() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role_name, salon_id')
    .eq('profile_id', user.id);

  return {
    id: user.id,
    email: user.email,
    profile,
    roles: roles || [],
  };
}

// ============================================
// LOGOUT
// ============================================

export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}
