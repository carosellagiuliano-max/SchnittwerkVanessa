import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check staff role (only active staff)
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember || !['admin', 'manager', 'hq'].includes(staffMember.role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, birth_date, gender, created_at, tags')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }

    const { data: customers, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build CSV
    const headers = ['ID', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Geburtsdatum', 'Geschlecht', 'Erstellt', 'Tags'];
    const rows = (customers || []).map(c => [
      c.id,
      c.first_name,
      c.last_name,
      c.email,
      c.phone || '',
      c.birth_date || '',
      c.gender || '',
      new Date(c.created_at).toLocaleDateString('de-CH'),
      (c.tags || []).join(';'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kunden_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
