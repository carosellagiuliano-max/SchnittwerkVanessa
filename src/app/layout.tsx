import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { LocalBusinessJsonLd } from '@/components/seo/json-ld';
import { CartProvider } from '@/contexts/cart-context';
import { CartDrawer } from '@/components/shop/cart-drawer';
import { getSalon, getOpeningHours } from '@/lib/actions';
import './globals.css';

// ============================================
// FONTS
// ============================================

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: {
    default: 'SCHNITTWERK | Premium Friseursalon St. Gallen',
    template: '%s | SCHNITTWERK',
  },
  description:
    'SCHNITTWERK - Ihr exklusiver Friseursalon in St. Gallen. Professionelle Haarschnitte, Colorationen und Styling. Buchen Sie jetzt Ihren Termin online.',
  keywords: [
    'Friseur',
    'Friseursalon',
    'St. Gallen',
    'Haarschnitt',
    'Coloration',
    'Styling',
    'Haarpflege',
    'Premium Salon',
    'SCHNITTWERK',
  ],
  authors: [{ name: 'SCHNITTWERK' }],
  creator: 'SCHNITTWERK',
  publisher: 'SCHNITTWERK',
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://schnittwerk.ch'
  ),
  alternates: {
    canonical: '/',
    languages: {
      'de-CH': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'de_CH',
    url: '/',
    siteName: 'SCHNITTWERK',
    title: 'SCHNITTWERK | Premium Friseursalon St. Gallen',
    description:
      'Ihr exklusiver Friseursalon in St. Gallen. Professionelle Haarschnitte, Colorationen und Styling.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'SCHNITTWERK - Premium Friseursalon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SCHNITTWERK | Premium Friseursalon St. Gallen',
    description:
      'Ihr exklusiver Friseursalon in St. Gallen. Buchen Sie jetzt Ihren Termin online.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
};

// ============================================
// ROOT LAYOUT
// ============================================

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch data for JSON-LD (cached)
  const [salon, openingHours] = await Promise.all([
    getSalon(),
    getOpeningHours(),
  ]);

  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        {/* Structured Data for Local Business */}
        <LocalBusinessJsonLd salon={salon} openingHours={openingHours} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-gradient-beauty`}
      >
        <CartProvider>
          {/* Decorative background elements */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-60 blur-3xl" />
            <div className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-rose/5 via-transparent to-transparent opacity-40 blur-3xl" />
          </div>

          {/* Header */}
          <Header />

          {/* Main Content - with top padding for fixed header */}
          <main className="min-h-screen pt-16 lg:pt-20 animate-fade-in">
            {children}
          </main>

          {/* Footer */}
          <Footer />

          {/* Cart Drawer */}
          <CartDrawer />

          {/* Toast Notifications */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-card/95 backdrop-blur-xl border-border/50 shadow-elegant',
                title: 'text-foreground font-medium',
                description: 'text-muted-foreground',
                success: 'border-l-4 border-l-emerald-500',
                error: 'border-l-4 border-l-destructive',
                warning: 'border-l-4 border-l-amber-500',
                info: 'border-l-4 border-l-primary',
              },
            }}
          />
        </CartProvider>
      </body>
    </html>
  );
}
