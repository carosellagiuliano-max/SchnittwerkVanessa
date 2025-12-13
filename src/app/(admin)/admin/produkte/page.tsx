import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { AdminProductList } from '@/components/admin/admin-product-list';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Produktverwaltung',
};

// ============================================
// DATA FETCHING
// ============================================

async function getProductsData(searchParams: {
  search?: string;
  category?: string;
  page?: string;
  limit?: string;
}) {
  const supabase = await createServerClient();
  const page = parseInt(searchParams.page || '1');
  const limit = parseInt(searchParams.limit || '20');
  const offset = (page - 1) * limit;
  const search = searchParams.search || '';
  const category = searchParams.category;

  let query = supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      price_cents,
      compare_at_price_cents,
      stock_quantity,
      sku,
      category_id,
      is_active,
      created_at,
      product_categories (
        id,
        name
      ),
      product_images (
        url,
        is_primary
      )
    `,
      { count: 'exact' }
    )
    .order('name')
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  if (category && category !== 'all') {
    query = query.eq('category_id', category);
  }

  const { data, count, error } = await query;

  // Get categories for filter
  const { data: categoriesData } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name') as { data: { id: string; name: string }[] | null };

  if (error) {
    console.error('Error fetching products:', error);
    return { products: [], total: 0, page, limit, categories: [] };
  }

  // Transform data to include category name and primary image
  const products = (data || []).map((p: any) => {
    // Find primary image, or first image, or null
    const images = p.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];

    return {
      ...p,
      category: p.product_categories?.name || null,
      image_url: primaryImage?.url || null,
    };
  });

  // Transform categories for the dropdown
  const categories = (categoriesData || []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return {
    products,
    total: count || 0,
    page,
    limit,
    categories,
  };
}

// ============================================
// ADMIN PRODUCTS PAGE
// ============================================

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const { products, total, page, limit, categories } =
    await getProductsData(params);

  return (
    <AdminProductList
      products={products}
      total={total}
      page={page}
      limit={limit}
      categories={categories}
      initialSearch={params.search || ''}
      initialCategory={params.category || 'all'}
    />
  );
}
