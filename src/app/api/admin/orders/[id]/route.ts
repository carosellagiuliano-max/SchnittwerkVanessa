import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// GET - Fetch Order Details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check staff role
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(`*, customers (*), order_items (*)`)
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// PUT - Update Order
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check staff role
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember || !['admin', 'manager', 'hq'].includes(staffMember.role)) {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, trackingNumber, notes } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (trackingNumber !== undefined) updateData.tracking_number = trackingNumber;
    if (notes !== undefined) updateData.notes = notes;

    // Update order
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Order update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log order event
    if (status) {
      await supabase.from('order_events').insert({
        order_id: id,
        event_type: 'status_changed',
        description: `Status geändert zu: ${status}`,
        created_by: staffMember.id,
      });
    }

    if (trackingNumber) {
      await supabase.from('order_events').insert({
        order_id: id,
        event_type: 'shipped',
        description: `Tracking-Nummer: ${trackingNumber}`,
        created_by: staffMember.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
