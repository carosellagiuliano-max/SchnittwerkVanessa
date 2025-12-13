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

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = ['ID', 'SKU', 'Name', 'Beschreibung', 'Kategorie', 'Preis (CHF)', 'Bestand', 'Min. Bestand', 'Aktiv'];
    const rows = (products || []).map(p => [
      p.id,
      p.sku || '',
      p.name,
      p.description || '',
      p.category || '',
      ((p.price_cents || 0) / 100).toFixed(2),
      p.stock_quantity || 0,
      p.min_stock_level || 0,
      p.is_active ? 'Ja' : 'Nein',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="produkte_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
