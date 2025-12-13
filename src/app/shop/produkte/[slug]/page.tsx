import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, ArrowLeft, Check, Truck, Store, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { createServerClient } from '@/lib/supabase/server';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';

// ============================================
// DATA FETCHING
// ============================================

async function getProduct(slug: string) {
  const supabase = await createServerClient();

  const { data: product, error } = await supabase
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
        id,
        url,
        alt_text,
        is_primary,
        sort_order
      )
    `
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    return null;
  }

  // Sort images, primary first
  const images = (product.product_images || []).sort((a: any, b: any) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    priceCents: product.price_cents,
    compareAtPriceCents: product.compare_at_price_cents,
    stockQuantity: product.stock_quantity,
    sku: product.sku,
    category: (product.product_categories as any)?.name || null,
    categorySlug: (product.product_categories as any)?.slug || null,
    images,
  };
}

async function getRelatedProducts(categorySlug: string | null, currentId: string) {
  if (!categorySlug) return [];

  const supabase = await createServerClient();

  const { data } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      price_cents,
      product_images (
        url,
        is_primary
      )
    `
    )
    .eq('is_active', true)
    .neq('id', currentId)
    .limit(4);

  return (data || []).map((p: any) => {
    const images = p.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceCents: p.price_cents,
      imageUrl: primaryImage?.url || null,
    };
  });
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: 'Produkt nicht gefunden' };
  }

  return {
    title: product.name,
    description: product.description || `${product.name} im SCHNITTWERK Shop`,
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

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.categorySlug, product.id);
  const primaryImage = product.images[0];
  const inStock = product.stockQuantity === null || product.stockQuantity > 0;
  const isOnSale = product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents;

  return (
    <div className="py-12">
      <div className="container-wide">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-muted-foreground mb-8">
          <Link href="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <Link href="/shop/produkte" className="hover:text-foreground">
            Produkte
          </Link>
          {product.category && (
            <>
              <span className="mx-2">/</span>
              <span className="text-foreground">{product.category}</span>
            </>
          )}
        </nav>

        {/* Product Detail */}
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-xl overflow-hidden">
              {primaryImage ? (
                <img
                  src={primaryImage.url}
                  alt={primaryImage.alt_text || product.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShoppingBag className="h-24 w-24 text-muted-foreground/20" />
                </div>
              )}
              {isOnSale && (
                <div className="absolute top-4 left-4">
                  <Badge variant="destructive" className="text-sm px-3 py-1">
                    Sale
                  </Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img: any, index: number) => (
                  <button
                    key={img.id || index}
                    className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 ${
                      index === 0 ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.alt_text || `${product.name} ${index + 1}`}
                      className="object-cover w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                {product.category}
              </p>
            )}
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

            {/* Price */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(product.priceCents)}
              </span>
              {isOnSale && (
                <span className="text-xl text-muted-foreground line-through">
                  {formatPrice(product.compareAtPriceCents!)}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-6">
              {inStock ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-medium">Auf Lager</span>
                </>
              ) : (
                <span className="text-destructive font-medium">Nicht auf Lager</span>
              )}
            </div>

            {/* Add to Cart */}
            <div className="mb-8">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  priceCents: product.priceCents,
                  imageUrl: primaryImage?.url,
                  sku: product.sku,
                }}
                disabled={!inStock}
                size="lg"
                className="w-full md:w-auto md:min-w-[200px]"
              />
            </div>

            <Separator className="my-8" />

            {/* Description */}
            {product.description && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Beschreibung</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Product Details */}
            {product.sku && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Artikelnummer:</span> {product.sku}
              </div>
            )}

            <Separator className="my-8" />

            {/* Shipping Info */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Versand</p>
                  <p className="text-xs text-muted-foreground">
                    Kostenlos ab CHF 50
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Store className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Click & Collect</p>
                  <p className="text-xs text-muted-foreground">
                    Im Salon abholen
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Rückgabe</p>
                  <p className="text-xs text-muted-foreground">
                    14 Tage Rückgaberecht
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-8">Das könnte Ihnen auch gefallen</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <Card key={p.id} className="group overflow-hidden border-border/50">
                  <Link href={`/shop/produkte/${p.slug}`}>
                    <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShoppingBag className="h-12 w-12 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <CardContent className="p-4">
                    <Link href={`/shop/produkte/${p.slug}`}>
                      <h3 className="font-semibold mb-2 hover:text-primary transition-colors">
                        {p.name}
                      </h3>
                    </Link>
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(p.priceCents)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
