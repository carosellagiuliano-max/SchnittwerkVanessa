import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, Calendar } from 'lucide-react';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Profil',
};

// ============================================
// TYPES
// ============================================

interface StaffMemberRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

// ============================================
// DATA FETCHING
// ============================================

async function getProfileData() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, staff: null };
  }

  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, display_name, phone, role, created_at')
    .eq('profile_id', user.id)
    .single() as { data: StaffMemberRow | null };

  return {
    user,
    staff: staffMember,
  };
}

// ============================================
// ADMIN PROFILE PAGE
// ============================================

export default async function AdminProfilePage() {
  const { user, staff } = await getProfileData();

  if (!user || !staff) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Profil nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mein Profil</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Ihre persönlichen Informationen
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Persönliche Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  defaultValue={staff.display_name || ''}
                  className="pl-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  defaultValue={user.email || ''}
                  className="pl-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  defaultValue={staff.phone || ''}
                  className="pl-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rolle</Label>
              <Input id="role" defaultValue={staff.role} readOnly />
            </div>
            <Button variant="outline" className="w-full" disabled>
              Profil bearbeiten (bald verfügbar)
            </Button>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Konto-Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memberSince">Mitglied seit</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="memberSince"
                  defaultValue={new Date(staff.created_at).toLocaleDateString('de-CH')}
                  className="pl-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">Benutzer-ID</Label>
              <Input id="userId" defaultValue={user.id} readOnly className="font-mono text-xs" />
            </div>
            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full" disabled>
                Passwort ändern (bald verfügbar)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für Änderungen an Ihrem Profil oder Passwort wenden Sie sich bitte an
            einen Administrator oder den Support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}







