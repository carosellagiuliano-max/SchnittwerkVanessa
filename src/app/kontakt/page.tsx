import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Instagram,
  Facebook,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSalon, getOpeningHours } from '@/lib/actions';
import { ContactForm } from '@/components/forms/contact-form';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Kontakt',
  description:
    'Kontaktieren Sie SCHNITTWERK in St. Gallen. Adresse, Öffnungszeiten, Telefon und Kontaktformular. Wir freuen uns auf Ihre Nachricht.',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatOpeningTime(time: string | null): string {
  if (!time) return '';
  // Convert "08:30:00" or "08:30" to "08:30"
  return time.substring(0, 5);
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function KontaktPage() {
  const [salon, openingHours] = await Promise.all([
    getSalon(),
    getOpeningHours(),
  ]);

  const googleMapsUrl = salon
    ? `https://maps.google.com/?q=${encodeURIComponent(
        `${salon.address}, ${salon.zipCode} ${salon.city}`
      )}`
    : '#';

  return (
    <div className="py-12">
      {/* Page Header */}
      <section className="container-wide mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-primary text-sm font-medium uppercase tracking-wider mb-2">
            Wir sind für Sie da
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Kontakt</h1>
          <p className="text-lg text-muted-foreground">
            Haben Sie Fragen oder möchten Sie einen Termin vereinbaren? Wir
            freuen uns, von Ihnen zu hören.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="container-wide">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Info */}
          <div className="space-y-6">
            {/* Address Card */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Adresse</h3>
                    <p className="text-sm text-muted-foreground">
                      {salon?.address}
                      <br />
                      {salon?.zipCode} {salon?.city}
                    </p>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      Route anzeigen →
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Phone Card */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <a
                    href="tel:0718019265"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                    aria-label="Telefon: 071 801 92 65"
                  >
                    <Phone className="h-5 w-5 text-primary" />
                  </a>
                  <div>
                    <h3 className="font-semibold mb-1">Telefon</h3>
                    <a
                      href="tel:0718019265"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      071 801 92 65
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Card */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">E-Mail</h3>
                    {salon?.email && (
                      <a
                        href={`mailto:${salon.email}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {salon.email}
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">Social Media</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" asChild>
                    <a
                      href="https://instagram.com/schnittwerk.sg"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a
                      href="https://facebook.com/schnittwerk"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                    >
                      <Facebook className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader>
              <CardTitle>Nachricht senden</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Opening Hours Section */}
      <section id="oeffnungszeiten" className="container-wide mt-16">
        <Card className="border-border/50">
          <CardContent className="p-8">
            <div className="grid gap-8 md:grid-cols-2">
              {/* Hours */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Öffnungszeiten</h2>
                </div>
                <ul className="space-y-3">
                  {openingHours.map((item) => (
                    <li
                      key={item.dayOfWeek}
                      className="flex justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <span className="font-medium">{item.dayName}</span>
                      <span
                        className={
                          !item.isOpen
                            ? 'text-muted-foreground/60'
                            : 'text-muted-foreground'
                        }
                      >
                        {item.isOpen
                          ? `${formatOpeningTime(item.openTime)} - ${formatOpeningTime(item.closeTime)}`
                          : 'Geschlossen'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Map Placeholder */}
              <div className="relative aspect-video md:aspect-auto bg-muted rounded-xl overflow-hidden min-h-[300px]">
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
                    salon ? `${salon.address}, ${salon.zipCode} ${salon.city}` : 'St. Gallen'
                  )}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '300px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="container-wide mt-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Lieber direkt buchen?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Sparen Sie sich das Warten – buchen Sie Ihren Wunschtermin bequem online.
        </p>
        <Button size="lg" className="btn-glow" asChild>
          <Link href="/termin-buchen">
            <Calendar className="mr-2 h-5 w-5" />
            Online Termin buchen
          </Link>
        </Button>
      </section>
    </div>
  );
}
