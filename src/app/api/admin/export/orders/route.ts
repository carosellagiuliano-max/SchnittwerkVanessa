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
      .from('orders')
      .select(`
        id, order_number, created_at, status, payment_status,
        subtotal_cents, shipping_cents, tax_cents, total_cents,
        customers (first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });

    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      query = query.lte('created_at', to);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['Bestellnummer', 'Datum', 'Kunde', 'E-Mail', 'Status', 'Zahlungsstatus', 'Zwischensumme', 'Versand', 'MwSt', 'Total'];
    const rows = (orders || []).map(o => [
      o.order_number,
      new Date(o.created_at).toLocaleDateString('de-CH'),
      o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : '',
      o.customers?.email || '',
      o.status,
      o.payment_status,
      ((o.subtotal_cents || 0) / 100).toFixed(2),
      ((o.shipping_cents || 0) / 100).toFixed(2),
      ((o.tax_cents || 0) / 100).toFixed(2),
      ((o.total_cents || 0) / 100).toFixed(2),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bestellungen_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
