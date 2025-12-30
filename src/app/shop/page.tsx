import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Gift, Star, ArrowRight, Package, Sparkles, Truck, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createServerClient } from '@/lib/supabase/server';
import { AddToCartButton } from '@/components/shop/add-to-cart-button';

// Force dynamic rendering - database not available during build
export const dynamic = 'force-dynamic';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Entdecken Sie professionelle Haarpflegeprodukte und Geschenkgutscheine im SCHNITTWERK Online-Shop. Premium-Qualitaet fuer Ihr Haar.',
};

// ============================================
// DATA FETCHING
// ============================================

async function getFeaturedProducts() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      price_cents,
      compare_at_price_cents,
      sku,
      product_categories (
        name
      ),
      product_images (
        url,
        is_primary
      )
    `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(4);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return (data || []).map((p: any) => {
    const images = p.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceCents: p.price_cents,
      compareAtPriceCents: p.compare_at_price_cents,
      sku: p.sku,
      category: p.product_categories?.name || null,
      imageUrl: primaryImage?.url || null,
    };
  });
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

async function getCategories(): Promise<Category[]> {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('product_categories')
    .select('id, name, slug, description')
    .eq('is_active', true)
    .order('name');

  return (data as Category[]) || [];
}

// ============================================
// PRODUCT CATEGORY DATA
// ============================================

const categoryIcons: Record<string, React.ElementType> = {
  haarpflege: Package,
  styling: Star,
  default: Package,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ShopPage() {
  const [featuredProducts, categories] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
  ]);

  return (
    <div className="py-12 md:py-16">
      {/* Page Header with elegant styling */}
      <section className="container-wide mb-16 md:mb-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Premium Produkte
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Unser{' '}
            <span className="text-gradient-primary">Shop</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Entdecken Sie unsere handverlesene Auswahl an professionellen
            Haarpflegeprodukten - dieselben, die wir im Salon verwenden.
          </p>
        </div>
      </section>

      {/* Category Cards with enhanced styling */}
      <section className="container-wide mb-16 md:mb-20">
        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          {/* Dynamic Categories */}
          {categories.map((category) => {
            const Icon = categoryIcons[category.slug] || categoryIcons.default;
            return (
              <Link key={category.id} href={`/shop/produkte?category=${category.id}`}>
                <Card className="group h-full card-elegant overflow-hidden">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow-sm">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {category.description || 'Produkte entdecken'}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground/40 transition-all duration-300 group-hover:text-primary group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {/* Gift Vouchers - Always show */}
          <Link href="/shop/gutscheine">
            <Card className="group h-full overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 transition-all duration-300 hover:shadow-glow hover:border-primary/40">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-all duration-300 group-hover:scale-105 shadow-glow-sm">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors">
                      Geschenkgutscheine
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Das perfekte Geschenk fuer jeden Anlass
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground/40 transition-all duration-300 group-hover:text-primary group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container-wide mb-16 md:mb-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Beliebte Produkte</h2>
            <p className="text-muted-foreground">
              Unsere meistverkauften Produkte
            </p>
          </div>
          <Button variant="outline" asChild className="rounded-full hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
            <Link href="/shop/produkte">
              Alle Produkte
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {featuredProducts.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="p-12 md:p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Noch keine Produkte</h3>
              <p className="text-muted-foreground">
                Produkte werden demnaechst hinzugefuegt.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product, index) => (
              <Card
                key={product.id}
                className="group overflow-hidden card-elegant animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image */}
                <Link href={`/shop/produkte/${product.slug}`}>
                  <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/30 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ShoppingBag className="h-16 w-16 text-muted-foreground/15" />
                      </div>
                    )}

                    {/* Overlay gradient on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Quick view button on hover */}
                    <div className="absolute bottom-4 left-4 right-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <Button variant="secondary" size="sm" className="w-full bg-background/90 backdrop-blur-sm hover:bg-background">
                        Details ansehen
                      </Button>
                    </div>

                    {/* Sale Badge */}
                    {product.compareAtPriceCents &&
                      product.compareAtPriceCents > product.priceCents && (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-destructive text-destructive-foreground shadow-lg">
                            Sale
                          </Badge>
                        </div>
                      )}

                    {/* Wishlist button */}
                    <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 hover:bg-background hover:text-primary">
                      <Heart className="h-4 w-4" />
                    </button>
                  </div>
                </Link>

                {/* Content */}
                <CardContent className="p-4 md:p-5">
                  {product.category && (
                    <p className="text-xs text-primary/80 uppercase tracking-wider font-medium mb-1.5">
                      {product.category}
                    </p>
                  )}
                  <Link href={`/shop/produkte/${product.slug}`}>
                    <h3 className="font-semibold text-base mb-2 line-clamp-2 hover:text-primary transition-colors duration-200">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(product.priceCents)}
                    </span>
                    {product.compareAtPriceCents &&
                      product.compareAtPriceCents > product.priceCents && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.compareAtPriceCents)}
                        </span>
                      )}
                  </div>
                  <AddToCartButton
                    product={{
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      priceCents: product.priceCents,
                      imageUrl: product.imageUrl,
                      sku: product.sku,
                    }}
                    size="sm"
                    className="w-full rounded-xl btn-glow"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Gift Voucher CTA */}
      <section className="container-wide mb-16 md:mb-20">
        <Card className="overflow-hidden border-0 shadow-elegant-lg">
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-rose/10">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-rose/10 to-transparent rounded-full blur-2xl" />

            <CardContent className="relative p-8 md:p-12 lg:p-16">
              <div className="grid gap-8 md:gap-12 md:grid-cols-2 items-center">
                <div>
                  <Badge className="mb-6 bg-primary/20 text-primary border-0 px-4 py-1.5">
                    <Gift className="h-3.5 w-3.5 mr-1.5" />
                    Geschenkidee
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                    Verschenken Sie
                    <br />
                    <span className="text-gradient-primary">pure Schoenheit</span>
                  </h2>
                  <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                    Unsere Gutscheine sind in beliebiger Hoehe erhaeltlich und koennen
                    fuer alle Leistungen und Produkte eingeloest werden.
                  </p>
                  <ul className="space-y-3 text-muted-foreground mb-8">
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Gift className="h-4 w-4 text-primary" />
                      </div>
                      Wert frei waehlbar (ab CHF 25)
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      Digital oder als Geschenkkarte
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      2 Jahre gueltig
                    </li>
                  </ul>
                  <Button asChild size="lg" className="btn-glow rounded-full px-8 shadow-glow">
                    <Link href="/shop/gutscheine">
                      <Gift className="mr-2 h-5 w-5" />
                      Gutschein kaufen
                    </Link>
                  </Button>
                </div>

                {/* Image Placeholder */}
                <div className="relative">
                  <div className="aspect-square md:aspect-[4/3] bg-gradient-to-br from-primary/20 via-primary/10 to-rose/10 rounded-3xl flex items-center justify-center overflow-hidden">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse-glow rounded-full" />
                      <Gift className="h-24 w-24 text-primary/40 animate-float" />
                    </div>
                  </div>
                  {/* Floating badges */}
                  <div className="absolute -top-4 -right-4 px-4 py-2 bg-background rounded-full shadow-elegant border border-border/50 text-sm font-medium">
                    Ab CHF 25
                  </div>
                  <div className="absolute -bottom-4 -left-4 px-4 py-2 bg-background rounded-full shadow-elegant border border-border/50 text-sm font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    Beliebt
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>

      {/* Info Section */}
      <section className="container-wide">
        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          <Card className="card-elegant group">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Truck className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Versandkostenfrei</h3>
              <p className="text-sm text-muted-foreground">
                Ab CHF 50 Bestellwert
              </p>
            </CardContent>
          </Card>
          <Card className="card-elegant group">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <Star className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Profi-Qualitaet</h3>
              <p className="text-sm text-muted-foreground">
                Dieselben Produkte wie im Salon
              </p>
            </CardContent>
          </Card>
          <Card className="card-elegant group">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Click & Collect</h3>
              <p className="text-sm text-muted-foreground">
                Kostenlos im Salon abholen
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
