import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { AdminCustomerList } from '@/components/admin/admin-customer-list';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kundenverwaltung',
};

// ============================================
// DATA FETCHING
// ============================================

async function getCustomersData(searchParams: {
  search?: string;
  page?: string;
  limit?: string;
}) {
  const supabase = await createServerClient();
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const offset = (page - 1) * limit;
  const search = searchParams.search || '';

  let query = supabase
    .from('customers')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone,
      created_at,
      is_active,
      profile:profiles!profile_id (
        email,
        phone
      ),
      appointments (count)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching customers:', error);
    return { customers: [], total: 0, page, limit };
  }

  return {
    customers: data || [],
    total: count || 0,
    page,
    limit,
  };
}

// ============================================
// ADMIN CUSTOMERS PAGE
// ============================================

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const { customers, total, page, limit } = await getCustomersData(params);

  return (
    <AdminCustomerList
      customers={customers}
      total={total}
      page={page}
      limit={limit}
      initialSearch={params.search || ''}
    />
  );
}
