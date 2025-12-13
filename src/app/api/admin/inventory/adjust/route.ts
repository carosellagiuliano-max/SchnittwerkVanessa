import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

interface AdjustStockRequest {
  productId: string;
  quantity: number;
  movementType: string;
  notes?: string;
  variantId?: string;
}

// ============================================
// POST - Adjust Stock
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check admin role (only active staff)
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

    // Parse request body
    const body: AdjustStockRequest = await request.json();
    const { productId, quantity, movementType, notes, variantId } = body;

    if (!productId || quantity === undefined || !movementType) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      );
    }

    // Call the adjust_stock function
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: productId,
      p_quantity_change: quantity,
      p_movement_type: movementType,
      p_reference_type: 'manual_adjustment',
      p_reference_id: null,
      p_notes: notes || null,
      p_created_by: user.id,
      p_variant_id: variantId || null,
    });

    if (error) {
      console.error('Stock adjustment error:', error);
      return NextResponse.json(
        { error: error.message || 'Fehler beim Anpassen des Bestands' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newQuantity: data,
      message: 'Bestand erfolgreich angepasst',
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
