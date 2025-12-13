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

    // Only active staff can export
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
    const status = searchParams.get('status');

    let query = supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status, total_price_cents, notes,
        customers (first_name, last_name, email),
        services (name),
        staff (display_name)
      `)
      .order('start_time', { ascending: false });

    if (from) {
      query = query.gte('start_time', from);
    }
    if (to) {
      query = query.lte('start_time', to);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: appointments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['ID', 'Datum', 'Uhrzeit', 'Kunde', 'E-Mail', 'Service', 'Mitarbeiter', 'Status', 'Preis (CHF)', 'Notizen'];
    const rows = (appointments || []).map(a => [
      a.id,
      new Date(a.start_time).toLocaleDateString('de-CH'),
      new Date(a.start_time).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
      a.customers ? `${a.customers.first_name} ${a.customers.last_name}` : '',
      a.customers?.email || '',
      a.services?.name || '',
      a.staff?.display_name || '',
      a.status,
      ((a.total_price_cents || 0) / 100).toFixed(2),
      a.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="termine_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
