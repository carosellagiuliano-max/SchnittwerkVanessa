import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// GET - Fetch Customer Details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Check authentication
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

    if (!staffMember) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // Get customer
    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        *,
        profiles (email, phone, avatar_url),
        loyalty_accounts (points_balance, tier)
      `)
      .eq('id', id)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Customer fetch error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// PUT - Update Customer
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Check authentication
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
        { error: 'Keine Berechtigung für diese Aktion' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, phone, birthDate, gender, notes, tags, marketingConsent } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (birthDate !== undefined) updateData.birth_date = birthDate;
    if (gender !== undefined) updateData.gender = gender;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;

    // Update customer
    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Customer update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update marketing consent if provided
    if (marketingConsent !== undefined) {
      // Get customer's profile_id
      const { data: customer } = await supabase
        .from('customers')
        .select('profile_id')
        .eq('id', id)
        .single();

      if (customer?.profile_id) {
        // Upsert consent record
        await supabase
          .from('consents')
          .upsert(
            {
              profile_id: customer.profile_id,
              consent_type: 'marketing',
              consented: marketingConsent,
              consented_at: marketingConsent ? new Date().toISOString() : null,
              revoked_at: !marketingConsent ? new Date().toISOString() : null,
            },
            { onConflict: 'profile_id,consent_type' }
          );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer update error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// DELETE - Delete Customer (soft delete)
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check admin role
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember || !['admin', 'hq'].includes(staffMember.role)) {
      return NextResponse.json(
        { error: 'Nur Admins können Kunden löschen' },
        { status: 403 }
      );
    }

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Customer delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer delete error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}
