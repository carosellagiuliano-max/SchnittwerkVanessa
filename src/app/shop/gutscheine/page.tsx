'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gift, Mail, Printer, ShoppingBag, CheckCircle, ArrowLeft, Sparkles, Heart, Star, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface DeliveryOption {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  price: number;
}

// ============================================
// VOUCHER DATA
// ============================================

const presetAmounts = [
  { value: 2500, label: 'CHF 25' },
  { value: 5000, label: 'CHF 50' },
  { value: 7500, label: 'CHF 75' },
  { value: 10000, label: 'CHF 100' },
  { value: 15000, label: 'CHF 150' },
  { value: 20000, label: 'CHF 200' },
];

const deliveryOptions: DeliveryOption[] = [
  {
    id: 'email',
    name: 'Digital per E-Mail',
    description: 'Sofort versandfertig als PDF',
    icon: Mail,
    price: 0,
  },
  {
    id: 'print',
    name: 'Zum Selbstdrucken',
    description: 'Hochwertiges PDF zum Ausdrucken',
    icon: Printer,
    price: 0,
  },
  {
    id: 'card',
    name: 'Geschenkkarte',
    description: 'Elegante Karte per Post (2-3 Tage)',
    icon: Gift,
    price: 500,
  },
];

// ============================================
// PAGE COMPONENT
// ============================================

export default function GutscheinePage() {
  const { addItem } = useCart();

  // State
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5000); // Default CHF 50
  const [customAmount, setCustomAmount] = useState('');
  const [deliveryOption, setDeliveryOption] = useState('email');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Calculate total
  const amountCents = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : selectedAmount || 0;
  const deliveryPrice = deliveryOptions.find(o => o.id === deliveryOption)?.price || 0;
  const totalCents = amountCents + deliveryPrice;

  // Format price
  const formatPrice = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`;

  // Handle preset amount selection
  const handlePresetClick = (value: number) => {
    setSelectedAmount(value);
    setCustomAmount(''); // Clear custom amount when preset is selected
  };

  // Handle custom amount change
  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null); // Clear preset when custom is entered
  };

  // Validate and add to cart
  const handleAddToCart = () => {
    // Validate amount
    if (amountCents < 2500) {
      toast.error('Der Mindestbetrag ist CHF 25');
      return;
    }

    if (amountCents > 50000) {
      toast.error('Der Maximalbetrag ist CHF 500');
      return;
    }

    // Validate email for digital delivery
    if ((deliveryOption === 'email') && recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      toast.error('Bitte geben Sie eine gueltige E-Mail-Adresse ein');
      return;
    }

    setIsAdding(true);

    try {
      // Add voucher to cart
      addItem(
        {
          productId: `voucher-${Date.now()}`,
          type: 'voucher',
          quantity: 1,
          voucherValue: amountCents,
          recipientEmail: recipientEmail || undefined,
          recipientName: recipientName || undefined,
          personalMessage: personalMessage || undefined,
        },
        {
          name: `Geschenkgutschein ${formatPrice(amountCents)}`,
          description: `${deliveryOptions.find(o => o.id === deliveryOption)?.name}${recipientName ? ` fuer ${recipientName}` : ''}`,
          priceCents: totalCents,
        }
      );

      toast.success('Gutschein wurde zum Warenkorb hinzugefuegt');

      // Reset form
      setRecipientName('');
      setRecipientEmail('');
      setSenderName('');
      setPersonalMessage('');
    } catch (error) {
      console.error('Error adding voucher:', error);
      toast.error('Fehler beim Hinzufuegen zum Warenkorb');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      {/* Back Link */}
      <div className="container-wide mb-8">
        <Link
          href="/shop"
          className="group inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Zurueck zum Shop
        </Link>
      </div>

      {/* Page Header */}
      <section className="container-wide mb-12 md:mb-16">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <Badge className="mb-6 bg-primary/20 text-primary border-0 px-4 py-1.5">
              <Gift className="h-3.5 w-3.5 mr-1.5" />
              Das perfekte Geschenk
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
              Verschenken Sie
              <br />
              <span className="text-gradient-primary">pure Schoenheit</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Verschenken Sie Entspannung, Styling und Verwoehnmomente. Unsere
              Gutscheine sind fuer alle Leistungen und Produkte bei SCHNITTWERK
              einloesbar.
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                Wert frei waehlbar (ab CHF 25)
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                2 Jahre gueltig
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                Einloesbar fuer alle Leistungen & Produkte
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                Persoenliche Grussbotschaft moeglich
              </li>
            </ul>
          </div>

          {/* Image Placeholder */}
          <div className="relative">
            <div className="aspect-square bg-gradient-to-br from-primary/20 via-primary/10 to-rose/10 rounded-3xl flex items-center justify-center overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse-glow rounded-full" />
                <Gift className="h-32 w-32 text-primary/30 animate-float" />
              </div>
            </div>
            {/* Floating decorative elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-radial from-primary/20 to-transparent rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-radial from-rose/15 to-transparent rounded-full blur-2xl" />
            {/* Floating badges */}
            <div className="absolute top-4 right-4 px-4 py-2 bg-background/90 backdrop-blur-sm rounded-full shadow-elegant border border-border/50 text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Beliebt
            </div>
            <div className="absolute bottom-4 left-4 px-4 py-2 bg-background/90 backdrop-blur-sm rounded-full shadow-elegant border border-border/50 text-sm font-medium">
              Ab CHF 25
            </div>
          </div>
        </div>
      </section>

      {/* Voucher Configuration */}
      <section className="container-wide">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Amount Selection */}
            <Card className="card-elegant overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                  Betrag waehlen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount.value}
                      onClick={() => handlePresetClick(amount.value)}
                      className={`group p-4 rounded-xl border-2 transition-all duration-300 text-center ${
                        selectedAmount === amount.value && !customAmount
                          ? 'border-primary bg-primary/10 shadow-glow-sm'
                          : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                      }`}
                    >
                      <span className={`text-xl font-bold transition-colors duration-300 ${
                        selectedAmount === amount.value && !customAmount
                          ? 'text-primary'
                          : 'text-foreground group-hover:text-primary'
                      }`}>{amount.label}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="customAmount" className="text-sm text-muted-foreground">Oder eigenen Betrag eingeben</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-medium">CHF</span>
                    <Input
                      id="customAmount"
                      type="number"
                      min="25"
                      max="500"
                      step="5"
                      placeholder="z.B. 125"
                      className="w-32 rounded-xl"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Mindestbetrag CHF 25, Maximum CHF 500</p>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Option */}
            <Card className="card-elegant overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                  Versandart waehlen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <RadioGroup
                  value={deliveryOption}
                  onValueChange={setDeliveryOption}
                  className="space-y-3"
                >
                  {deliveryOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`group flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        deliveryOption === option.id
                          ? 'border-primary bg-primary/5 shadow-glow-sm'
                          : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                      }`}
                    >
                      <RadioGroupItem value={option.id} className="mt-1" />
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                        deliveryOption === option.id
                          ? 'bg-primary/20'
                          : 'bg-muted group-hover:bg-primary/10'
                      }`}>
                        <option.icon className={`h-5 w-5 transition-colors duration-300 ${
                          deliveryOption === option.id
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-primary'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{option.name}</span>
                          {option.price > 0 ? (
                            <span className="text-sm text-muted-foreground">
                              + CHF {(option.price / 100).toFixed(2)}
                            </span>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-0">
                              Kostenlos
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Personalization */}
            <Card className="card-elegant overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                  Personalisieren
                  <Badge variant="secondary" className="ml-2">Optional</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recipientName">Name des Beschenkten</Label>
                    <Input
                      id="recipientName"
                      placeholder="z.B. Anna"
                      className="rounded-xl"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  {deliveryOption === 'email' && (
                    <div className="space-y-2">
                      <Label htmlFor="recipientEmail">E-Mail des Beschenkten</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder="anna@example.com"
                        className="rounded-xl"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="senderName">Ihr Name</Label>
                    <Input
                      id="senderName"
                      placeholder="z.B. Max"
                      className="rounded-xl"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Persoenliche Nachricht</Label>
                  <Textarea
                    id="message"
                    placeholder="z.B. Alles Gute zum Geburtstag! Goenn dir etwas Schoenes..."
                    rows={3}
                    maxLength={200}
                    className="rounded-xl resize-none"
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {personalMessage.length}/200 Zeichen
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="card-elegant sticky top-24 overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-primary/10 to-transparent border-b border-border/50">
                <CardTitle>Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Preview */}
                <div className="relative aspect-[3/2] bg-gradient-to-br from-primary/15 via-primary/10 to-rose/10 rounded-2xl flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)]" />
                  <div className="text-center relative">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <Gift className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-primary">
                      {amountCents >= 2500 ? formatPrice(amountCents) : 'CHF --'}
                    </p>
                    {recipientName && (
                      <p className="text-sm text-muted-foreground mt-2">
                        fuer {recipientName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gutscheinwert</span>
                    <span className="font-medium">{amountCents >= 2500 ? formatPrice(amountCents) : '--'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {deliveryOptions.find(o => o.id === deliveryOption)?.name}
                    </span>
                    <span className={`font-medium ${deliveryPrice === 0 ? 'text-emerald-600' : ''}`}>
                      {deliveryPrice === 0 ? 'Kostenlos' : formatPrice(deliveryPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-4 border-t border-border/50">
                    <span>Gesamt</span>
                    <span className="text-primary text-xl">
                      {amountCents >= 2500 ? formatPrice(totalCents) : '--'}
                    </span>
                  </div>
                </div>

                {/* Buy Button */}
                <Button
                  className="w-full btn-glow rounded-xl h-12 text-base shadow-glow"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={amountCents < 2500 || isAdding}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  {isAdding ? 'Wird hinzugefuegt...' : 'In den Warenkorb'}
                </Button>

                {amountCents < 2500 && (
                  <p className="text-xs text-destructive text-center">
                    Bitte waehlen Sie einen Betrag (min. CHF 25)
                  </p>
                )}

                {/* Trust Badges */}
                <div className="text-center pt-4 border-t border-border/50">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Sichere Zahlung mit Karte oder TWINT
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-wide mt-16 md:mt-20">
        <Card className="card-elegant overflow-hidden">
          <div className="bg-gradient-to-br from-muted/50 to-transparent">
            <CardContent className="p-8 md:p-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  Haeufige Fragen
                </h2>
                <p className="text-muted-foreground">Alles was Sie wissen muessen</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <div className="p-5 rounded-xl bg-background/50 border border-border/50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Wie lange ist der Gutschein gueltig?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Alle Gutscheine sind 2 Jahre ab Kaufdatum gueltig.
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-background/50 border border-border/50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Kann ich den Gutschein auch fuer Produkte einloesen?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Ja, der Gutschein ist fuer alle Leistungen und Produkte
                    einloesbar.
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-background/50 border border-border/50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Was passiert mit dem Restguthaben?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Das Restguthaben bleibt erhalten und kann beim naechsten Besuch
                    eingeloest werden.
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-background/50 border border-border/50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Ist eine Barauszahlung moeglich?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Nein, eine Barauszahlung ist leider nicht moeglich.
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>
    </div>
  );
}
