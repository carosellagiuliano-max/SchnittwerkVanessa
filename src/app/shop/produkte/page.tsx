import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Filter, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createServerClient } from '@/lib/supabase/server';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Alle Produkte',
  description: 'Entdecken Sie alle Produkte im SCHNITTWERK Online-Shop.',
};

// ============================================
// DATA FETCHING
// ============================================

async function getProducts(searchParams: {
  category?: string;
  search?: string;
  page?: string;
}) {
  const supabase = await createServerClient();
  const page = parseInt(searchParams.page || '1');
  const limit = 12;
  const offset = (page - 1) * limit;

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
      is_active,
      product_categories (
        id,
        name,
        slug
      ),
      product_images (
        url,
        is_primary
      )
    `,
      { count: 'exact' }
    )
    .eq('is_active', true)
    .order('name')
    .range(offset, offset + limit - 1);

  if (searchParams.category && searchParams.category !== 'all') {
    query = query.eq('category_id', searchParams.category);
  }

  if (searchParams.search) {
    query = query.ilike('name', `%${searchParams.search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return { products: [], total: 0, page, limit };
  }

  // Get categories for filter
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name');

  // Transform products
  const products = (data || []).map((p: any) => {
    const images = p.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceCents: p.price_cents,
      compareAtPriceCents: p.compare_at_price_cents,
      stockQuantity: p.stock_quantity,
      sku: p.sku,
      category: p.product_categories?.name || null,
      categorySlug: p.product_categories?.slug || null,
      imageUrl: primaryImage?.url || null,
    };
  });

  return {
    products,
    categories: categories || [],
    total: count || 0,
    page,
    limit,
  };
}

// ============================================
// HELPER
// ============================================

function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { products, categories, total, page, limit } = await getProducts(params);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="py-12">
      <div className="container-wide">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zum Shop
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Alle Produkte</h1>
            <p className="text-muted-foreground">
              {total} {total === 1 ? 'Produkt' : 'Produkte'} gefunden
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/shop/produkte">
            <Badge
              variant={!params.category || params.category === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
            >
              Alle
            </Badge>
          </Link>
          {categories.map((cat: any) => (
            <Link key={cat.id} href={`/shop/produkte?category=${cat.id}`}>
              <Badge
                variant={params.category === cat.id ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {cat.name}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Keine Produkte gefunden</h2>
            <p className="text-muted-foreground mb-4">
              Versuchen Sie eine andere Kategorie oder Suche.
            </p>
            <Button asChild>
              <Link href="/shop/produkte">Alle Produkte anzeigen</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="group overflow-hidden border-border/50"
              >
                {/* Image */}
                <Link href={`/shop/produkte/${product.slug}`}>
                  <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/20" />
                      </div>
                    )}

                    {/* Sale Badge */}
                    {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="destructive">Sale</Badge>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <CardContent className="p-4">
                  {product.category && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {product.category}
                    </p>
                  )}
                  <Link href={`/shop/produkte/${product.slug}`}>
                    <h3 className="font-semibold mb-2 hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">
                        {formatPrice(product.priceCents)}
                      </span>
                      {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.compareAtPriceCents)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <AddToCartButton
                      product={{
                        id: product.id,
                        name: product.name,
                        priceCents: product.priceCents,
                        imageUrl: product.imageUrl,
                        sku: product.sku,
                      }}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/shop/produkte?page=${p}${params.category ? `&category=${params.category}` : ''}`}
              >
                <Button variant={p === page ? 'default' : 'outline'} size="sm">
                  {p}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
