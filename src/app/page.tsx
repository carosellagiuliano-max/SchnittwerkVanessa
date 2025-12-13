import Link from 'next/link';
import { MapPin, Clock, Sparkles, ArrowRight, Star, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// HOMEPAGE
// ============================================

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Info Cards */}
      <InfoCardsSection />

      {/* Services Preview */}
      <ServicesPreviewSection />

      {/* Reviews Section */}
      <ReviewsSection />

      {/* CTA Section */}
      <CTASection />
    </>
  );
}

// ============================================
// HERO SECTION
// ============================================

function HeroSection() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image/Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-charcoal/95 to-charcoal/90">
        {/* TODO: Add actual hero image */}
        <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] opacity-5" />
      </div>

      {/* Content */}
      <div className="relative container-wide py-20 text-center">
        <div className="mx-auto max-w-3xl animate-fade-in">
          {/* Tagline */}
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-4">
            Premium Friseursalon St. Gallen
          </p>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Your Style.{' '}
            <span className="text-gradient-gold">Your Statement.</span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            Willkommen bei SCHNITTWERK – wo Stil auf Handwerk trifft.
            Erleben Sie erstklassige Haarkunst in entspannter Atmosphäre.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="btn-glow text-base" asChild>
              <Link href="/termin-buchen">
                <Calendar className="mr-2 h-5 w-5" />
                Termin buchen
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 text-base"
              asChild
            >
              <Link href="/leistungen">
                Unsere Leistungen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
}

// ============================================
// INFO CARDS SECTION
// ============================================

function InfoCardsSection() {
  const infoCards = [
    {
      icon: MapPin,
      title: 'Standort',
      description: 'Musterstrasse 123, 9000 St. Gallen',
      link: {
        href: 'https://maps.google.com/?q=Musterstrasse+123,+9000+St.+Gallen',
        label: 'Route anzeigen',
        external: true,
      },
    },
    {
      icon: Clock,
      title: 'Öffnungszeiten',
      description: 'Di–Fr 09:00–18:00, Sa 09:00–16:00',
      link: {
        href: '/kontakt#oeffnungszeiten',
        label: 'Alle Zeiten',
      },
    },
    {
      icon: Sparkles,
      title: 'Premium Services',
      description: 'Balayage, Colorationen, Styling',
      link: {
        href: '/leistungen',
        label: 'Mehr erfahren',
      },
    },
  ];

  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        <div className="grid gap-6 md:grid-cols-3">
          {infoCards.map((card) => (
            <Card
              key={card.title}
              className="card-hover border-border/50 bg-card"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{card.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {card.description}
                    </p>
                    <Link
                      href={card.link.href}
                      target={card.link.external ? '_blank' : undefined}
                      rel={card.link.external ? 'noopener noreferrer' : undefined}
                      className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      {card.link.label}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// SERVICES PREVIEW SECTION
// ============================================

function ServicesPreviewSection() {
  const services = [
    {
      name: 'Herrenhaarschnitt',
      price: 'ab CHF 45',
      duration: '30 Min.',
    },
    {
      name: 'Damenhaarschnitt',
      price: 'ab CHF 75',
      duration: '45 Min.',
    },
    {
      name: 'Coloration',
      price: 'ab CHF 95',
      duration: '90 Min.',
    },
    {
      name: 'Balayage',
      price: 'ab CHF 180',
      duration: '150 Min.',
    },
  ];

  return (
    <section className="section-padding relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/40">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-amber-300/40 dark:bg-amber-800/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-300/30 dark:bg-rose-800/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="container-wide relative">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-amber-700 dark:text-amber-400 text-sm font-medium uppercase tracking-wider mb-2">
            Unsere Leistungen
          </p>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Beliebte Services
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Von klassischen Haarschnitten bis zu modernen Farbtechniken –
            entdecken Sie unser umfangreiches Angebot.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {services.map((service) => (
            <Card
              key={service.name}
              className="card-hover border-amber-200 dark:border-amber-800/50 bg-white/90 dark:bg-card/90 backdrop-blur-sm shadow-lg shadow-amber-200/50 dark:shadow-none hover:shadow-xl hover:shadow-amber-300/50 dark:hover:shadow-amber-900/30 transition-all duration-300"
            >
              <CardContent className="p-6 text-center">
                <h3 className="font-semibold text-foreground mb-2">
                  {service.name}
                </h3>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                  {service.price}
                </p>
                <p className="text-sm text-muted-foreground">{service.duration}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button variant="outline" size="lg" className="border-amber-400 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:border-amber-500 dark:hover:border-amber-600 text-amber-700 dark:text-amber-300" asChild>
            <Link href="/leistungen">
              Alle Leistungen ansehen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ============================================
// REVIEWS SECTION
// ============================================

function ReviewsSection() {
  const reviews = [
    {
      name: 'Sarah M.',
      rating: 5,
      text: 'Absolut bester Friseursalon in St. Gallen! Das Team ist super freundlich und das Ergebnis immer perfekt.',
    },
    {
      name: 'Thomas K.',
      rating: 5,
      text: 'Professionelle Beratung und erstklassiges Handwerk. Hier fühlt man sich wirklich gut aufgehoben.',
    },
    {
      name: 'Nina B.',
      rating: 5,
      text: 'Meine Balayage ist fantastisch geworden! Kann SCHNITTWERK nur empfehlen.',
    },
  ];

  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
            Kundenstimmen
          </p>
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Was unsere Kunden sagen
          </h2>
        </div>

        {/* Reviews Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {reviews.map((review, index) => (
            <Card key={index} className="border-border/50 bg-card">
              <CardContent className="p-6">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-primary text-primary"
                    />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-foreground/80 mb-4 italic">
                  &ldquo;{review.text}&rdquo;
                </p>

                {/* Author */}
                <p className="text-sm font-medium text-foreground">
                  {review.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Google Reviews Link */}
        <div className="text-center mt-8">
          <Link
            href="https://g.page/schnittwerk-stgallen/review"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Mehr Bewertungen auf Google →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================
// CTA SECTION
// ============================================

function CTASection() {
  return (
    <section className="py-20 bg-charcoal text-white">
      <div className="container-wide text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Bereit für Ihren neuen Look?
        </h2>
        <p className="text-white/70 mb-8 max-w-xl mx-auto">
          Buchen Sie jetzt Ihren Termin online – schnell, einfach und bequem.
          Wir freuen uns auf Sie!
        </p>
        <Button size="lg" className="btn-glow" asChild>
          <Link href="/termin-buchen">
            <Calendar className="mr-2 h-5 w-5" />
            Jetzt Termin buchen
          </Link>
        </Button>
      </div>
    </section>
  );
}
