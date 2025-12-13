import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

interface StaffMember {
  id: string;
  role: string;
  salon_id: string;
}

interface LoyaltyAccount {
  id: string;
  points_balance: number;
  tier?: string;
  total_points_earned?: number;
  salon_id?: string;
}

// ============================================
// POST - Adjust Loyalty Points
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check staff role (only active staff)
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id, role, salon_id')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single() as { data: StaffMember | null };

    if (!staffMember || !['admin', 'manager', 'hq'].includes(staffMember.role)) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diese Aktion' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { points, reason } = body;

    if (!points || points === 0) {
      return NextResponse.json({ error: 'Punkte erforderlich' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'Grund erforderlich' }, { status: 400 });
    }

    // Get or create loyalty account
    let { data: loyaltyAccount } = await supabase
      .from('loyalty_accounts')
      .select('id, points_balance')
      .eq('customer_id', customerId)
      .single() as { data: LoyaltyAccount | null };

    if (!loyaltyAccount) {
      // Create new loyalty account
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newAccount, error: createError } = await (supabase as any)
        .from('loyalty_accounts')
        .insert({
          customer_id: customerId,
          salon_id: staffMember.salon_id,
          points_balance: 0,
          tier: 'bronze',
          total_points_earned: 0,
        })
        .select('id, points_balance')
        .single() as { data: LoyaltyAccount | null; error: unknown };

      if (createError) {
        console.error('Loyalty account creation error:', createError);
        return NextResponse.json({ error: 'Fehler beim Erstellen des Kontos' }, { status: 500 });
      }

      loyaltyAccount = newAccount;
    }

    // Calculate new balance
    const newBalance = (loyaltyAccount.points_balance || 0) + points;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'Nicht genügend Punkte vorhanden' },
        { status: 400 }
      );
    }

    // Create transaction record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: transactionError } = await (supabase as any)
      .from('loyalty_transactions')
      .insert({
        customer_id: customerId,
        salon_id: staffMember.salon_id,
        loyalty_account_id: loyaltyAccount.id,
        transaction_type: 'adjust',
        points: points,
        description: reason,
        performed_by: staffMember.id,
      });

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      return NextResponse.json({ error: 'Fehler bei der Transaktion' }, { status: 500 });
    }

    // Update loyalty account balance
    const updateData: Record<string, unknown> = {
      points_balance: newBalance,
      updated_at: new Date().toISOString(),
    };

    // If adding points, also update total_points_earned
    if (points > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentAccount } = await (supabase as any)
        .from('loyalty_accounts')
        .select('total_points_earned')
        .eq('id', loyaltyAccount.id)
        .single() as { data: { total_points_earned: number } | null };

      updateData.total_points_earned = (currentAccount?.total_points_earned || 0) + points;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('loyalty_accounts')
      .update(updateData)
      .eq('id', loyaltyAccount.id);

    if (updateError) {
      console.error('Loyalty account update error:', updateError);
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
    }

    // Check if tier upgrade is needed
    await checkTierUpgrade(supabase, loyaltyAccount.id, updateData.total_points_earned as number);

    return NextResponse.json({
      success: true,
      newBalance,
      message: `${Math.abs(points)} Punkte ${points > 0 ? 'hinzugefügt' : 'abgezogen'}`,
    });
  } catch (error) {
    console.error('Loyalty adjustment error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// GET - Get Loyalty History
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const supabase = await createServerClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Check staff role (only active staff)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staffMember } = await (supabase as any)
      .from('staff')
      .select('id, role')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .single();

    if (!staffMember) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    // Get loyalty account and transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: account } = await (supabase as any)
      .from('loyalty_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: transactions } = await (supabase as any)
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      account: account || { points_balance: 0, tier: 'bronze' },
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('Loyalty fetch error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

// ============================================
// HELPER: Check for Tier Upgrade
// ============================================

async function checkTierUpgrade(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  accountId: string,
  totalPointsEarned: number
) {
  // Tier thresholds
  const tiers = [
    { name: 'platinum', threshold: 5000 },
    { name: 'gold', threshold: 2000 },
    { name: 'silver', threshold: 500 },
    { name: 'bronze', threshold: 0 },
  ];

  const newTier = tiers.find((t) => totalPointsEarned >= t.threshold)?.name || 'bronze';

  // Get current tier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase as any)
    .from('loyalty_accounts')
    .select('tier')
    .eq('id', accountId)
    .single() as { data: { tier: string } | null };

  if (account && account.tier !== newTier) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('loyalty_accounts')
      .update({ tier: newTier, updated_at: new Date().toISOString() })
      .eq('id', accountId);
  }
}
