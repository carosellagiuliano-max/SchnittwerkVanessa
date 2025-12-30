'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Phone,
  Instagram,
  User,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { CartButton } from '@/components/shop/cart-drawer';
import { features } from '@/lib/config/features';

// ============================================
// TYPES
// ============================================

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
  /** Feature flag key - if set, item only shows when feature is enabled */
  feature?: keyof typeof features;
}

// ============================================
// NAVIGATION DATA
// TODO: Fetch from database via salon settings
// ============================================

const navigationItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Leistungen', href: '/leistungen' },
  { label: 'Galerie', href: '/galerie', feature: 'galleryEnabled' },
  { label: 'Ueber uns', href: '/ueber-uns' },
  { label: 'Team', href: '/team' },
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Shop', href: '/shop', feature: 'shopEnabled' },
];

// Salon contact info - TODO: Fetch from database
const salonInfo = {
  name: 'SCHNITTWERK',
  phone: '071 801 92 65',
  phoneLink: 'tel:0718019265',
  instagram: 'https://instagram.com/schnittwerk',
};

// ============================================
// HEADER COMPONENT
// ============================================

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter navigation based on feature flags
  const navigation = useMemo(() =>
    navigationItems.filter(item => !item.feature || features[item.feature]),
    []
  );

  // Track scroll for header background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        isScrolled
          ? 'glass-strong py-2'
          : 'bg-gradient-to-b from-background/80 to-transparent py-3'
      )}
    >
      <div className="container-wide">
        <div className="flex h-12 items-center justify-between lg:h-14">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-xl font-bold tracking-tight lg:text-2xl"
          >
            <div className="relative">
              <Sparkles className="h-6 w-6 lg:h-7 lg:w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-gradient-primary">{salonInfo.name}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-0.5">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-full',
                  pathname === item.href
                    ? 'text-primary'
                    : 'text-foreground/70 hover:text-foreground'
                )}
              >
                {item.label}
                {/* Active indicator */}
                {pathname === item.href && (
                  <span className="absolute inset-x-2 -bottom-0.5 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />
                )}
                {/* Hover background */}
                <span className={cn(
                  'absolute inset-0 rounded-full bg-primary/5 scale-90 opacity-0 transition-all duration-300',
                  pathname !== item.href && 'hover:opacity-100 hover:scale-100'
                )} />
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {/* Phone */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-foreground/70 hover:text-foreground hover:bg-primary/5 rounded-full transition-all duration-300"
            >
              <a href={salonInfo.phoneLink} aria-label={`Telefon: ${salonInfo.phone}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>

            {/* Instagram */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-foreground/70 hover:text-foreground hover:bg-primary/5 rounded-full transition-all duration-300"
            >
              <a
                href={salonInfo.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </Button>

            {/* Cart - only show if shop is enabled */}
            {features.shopEnabled && <CartButton />}

            {/* Login */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-foreground/70 hover:text-foreground hover:bg-primary/5 rounded-full transition-all duration-300"
            >
              <Link href="/login" aria-label="Anmelden">
                <User className="h-4 w-4" />
              </Link>
            </Button>

            {/* Book Appointment CTA */}
            <Button
              asChild
              className="ml-3 btn-glow rounded-full px-5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-glow-sm"
            >
              <Link href="/termin-buchen">
                <Calendar className="h-4 w-4 mr-2" />
                Termin buchen
              </Link>
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center gap-1.5 lg:hidden">
            {/* Mobile Cart - only show if shop is enabled */}
            {features.shopEnabled && <CartButton />}

            {/* Mobile Menu Trigger */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Menu oeffnen"
                  className="hover:bg-primary/5 rounded-full"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[85vw] max-w-sm border-l-border/50 bg-gradient-to-b from-background to-muted/30"
              >
                <SheetHeader className="text-left pb-6 border-b border-border/50">
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-gradient-primary font-bold">{salonInfo.name}</span>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col h-[calc(100%-5rem)]">
                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-1 py-6">
                    {navigation.map((item, index) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group flex items-center justify-between px-4 py-3.5 text-base font-medium transition-all duration-300 rounded-xl',
                          pathname === item.href
                            ? 'text-primary bg-primary/10'
                            : 'text-foreground/80 hover:text-foreground hover:bg-muted/50'
                        )}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <span>{item.label}</span>
                        <ChevronRight className={cn(
                          'h-4 w-4 transition-transform duration-300',
                          pathname === item.href
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:translate-x-1'
                        )} />
                      </Link>
                    ))}
                  </nav>

                  {/* Mobile Actions */}
                  <div className="mt-auto space-y-3 border-t border-border/50 pt-6">
                    {/* Phone */}
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-xl border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                      asChild
                    >
                      <a href={salonInfo.phoneLink}>
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 mr-3">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        {salonInfo.phone}
                      </a>
                    </Button>

                    {/* Instagram */}
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-xl border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                      asChild
                    >
                      <a
                        href={salonInfo.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 mr-3">
                          <Instagram className="h-4 w-4 text-pink-500" />
                        </div>
                        Instagram
                      </a>
                    </Button>

                    {/* Login */}
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-xl border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                      asChild
                    >
                      <Link href="/login">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted mr-3">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        Anmelden
                      </Link>
                    </Button>

                    {/* Book Appointment CTA */}
                    <Button
                      className="w-full h-12 rounded-xl btn-glow bg-gradient-to-r from-primary to-primary/90 shadow-glow-sm"
                      asChild
                    >
                      <Link href="/termin-buchen">
                        <Calendar className="h-4 w-4 mr-2" />
                        Termin buchen
                      </Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
