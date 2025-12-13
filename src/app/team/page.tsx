import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Scissors, Award, Instagram, Star, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStaffMembers, getSalon } from '@/lib/actions';

// ============================================
// CONFIG - Force dynamic rendering (no cache)
// ============================================

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Unser Team',
  description:
    'Lernen Sie das SCHNITTWERK-Team kennen. Unsere erfahrenen Stylisten freuen sich darauf, Ihren perfekten Look zu kreieren.',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function TeamPage() {
  const [staff, salon] = await Promise.all([
    getStaffMembers(),
    getSalon(),
  ]);

  return (
    <div className="py-12 md:py-16">
      {/* Page Header */}
      <section className="container-wide mb-16 md:mb-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Heart className="h-4 w-4" />
            Die Menschen hinter {salon?.name || 'SCHNITTWERK'}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Unser{' '}
            <span className="text-gradient-primary">Team</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Lernen Sie die talentierten Stylisten kennen, die Ihren Besuch bei
            uns zu einem besonderen Erlebnis machen.
          </p>
        </div>
      </section>

      {/* Team Grid */}
      <section className="container-wide mb-16 md:mb-20">
        {staff.length > 0 ? (
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {staff.map((member, index) => (
              <Card
                key={member.id}
                className="group card-elegant overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-muted to-muted/30 overflow-hidden">
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      alt={member.displayName}
                      fill
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Scissors className="h-10 w-10 text-primary/40" />
                      </div>
                    </div>
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Social link on hover */}
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <Button variant="secondary" size="sm" className="w-full bg-background/90 backdrop-blur-sm hover:bg-background">
                      <Instagram className="h-4 w-4 mr-2" />
                      Profil ansehen
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <CardContent className="p-5 md:p-6">
                  <h3 className="font-semibold text-lg mb-1">{member.displayName}</h3>
                  {member.jobTitle && (
                    <p className="text-sm text-primary font-medium mb-3">{member.jobTitle}</p>
                  )}
                  {member.bio && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                      {member.bio}
                    </p>
                  )}

                  {/* Specialties */}
                  {member.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {member.specialties.map((specialty) => (
                        <Badge
                          key={specialty}
                          variant="secondary"
                          className="text-xs bg-primary/10 text-primary/80 border-0"
                        >
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Scissors className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground text-lg">
              Unser Team wird bald vorgestellt.
            </p>
          </div>
        )}
      </section>

      {/* Join Us Section */}
      <section className="container-wide mb-16 md:mb-20">
        <Card className="card-elegant overflow-hidden">
          <div className="bg-gradient-to-br from-muted/50 to-transparent">
            <CardContent className="p-8 md:p-12 lg:p-16">
              <div className="grid gap-10 md:grid-cols-2 items-center">
                <div>
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
                    <Award className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
                    Werde Teil unseres{' '}
                    <span className="text-gradient-primary">Teams</span>
                  </h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Du bist leidenschaftlicher Friseur und suchst eine neue
                    Herausforderung? Wir sind immer auf der Suche nach Talenten,
                    die unser Team bereichern.
                  </p>
                  <ul className="space-y-3 text-muted-foreground mb-8">
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      Attraktive Arbeitszeiten
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      Weiterbildungsmoeglichkeiten
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      Modernes Arbeitsumfeld
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      Familiaeres Team
                    </li>
                  </ul>
                  <Button variant="outline" size="lg" asChild className="rounded-full hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                    <Link href="/kontakt">Jetzt bewerben</Link>
                  </Button>
                </div>
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-primary/15 via-primary/10 to-rose/10 rounded-3xl flex items-center justify-center overflow-hidden">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse-glow rounded-full" />
                      <Sparkles className="h-20 w-20 text-primary/30 animate-float" />
                    </div>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-radial from-primary/15 to-transparent rounded-full blur-2xl" />
                  <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-radial from-rose/10 to-transparent rounded-full blur-2xl" />
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="container-wide">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
            Bereit fuer Ihren neuen{' '}
            <span className="text-gradient-primary">Look</span>?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Buchen Sie jetzt Ihren Termin bei einem unserer erfahrenen Stylisten.
          </p>
          <Button size="lg" className="btn-glow rounded-full px-8 shadow-glow" asChild>
            <Link href="/termin-buchen">
              <Calendar className="mr-2 h-5 w-5" />
              Termin buchen
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
