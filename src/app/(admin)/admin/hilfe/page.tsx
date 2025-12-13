import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Hilfe & Support',
};

// ============================================
// ADMIN HELP PAGE
// ============================================

export default function AdminHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hilfe & Support</h1>
        <p className="text-muted-foreground mt-2">
          Hier finden Sie Hilfe und Anleitungen für den Admin-Bereich
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Schnellstart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Erste Schritte</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Dashboard: Übersicht über Termine und Bestellungen</li>
                <li>• Kalender: Termine verwalten und anlegen</li>
                <li>• Kunden: Kundenverwaltung und -suche</li>
                <li>• Bestellungen: Bestellungen bearbeiten und verfolgen</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Common Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Häufige Aufgaben
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Was möchten Sie tun?</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Einen neuen Termin anlegen</li>
                <li>• Einen Kunden hinzufügen</li>
                <li>• Eine Bestellung bearbeiten</li>
                <li>• Inventar anpassen</li>
                <li>• Team-Mitglieder verwalten</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Support Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Support kontaktieren
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">E-Mail</p>
                  <a
                    href="mailto:support@schnittwerk.ch"
                    className="text-sm text-primary hover:underline"
                  >
                    support@schnittwerk.ch
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Telefon</p>
                  <a
                    href="tel:+41123456789"
                    className="text-sm text-primary hover:underline"
                  >
                    +41 12 345 67 89
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Dokumentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Ausführliche Dokumentation und Anleitungen finden Sie in unserem
                Handbuch.
              </p>
              <Button variant="outline" asChild>
                <Link href="/docs" target="_blank">
                  Dokumentation öffnen
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Häufig gestellte Fragen (FAQ)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Wie lege ich einen neuen Termin an?</h3>
            <p className="text-sm text-muted-foreground">
              Gehen Sie zum Kalender und klicken Sie auf "Neuer Termin". Wählen Sie
              dann den Kunden, die Dienstleistung und den Mitarbeiter aus.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Wie bearbeite ich eine Bestellung?</h3>
            <p className="text-sm text-muted-foreground">
              Öffnen Sie die Bestellungen-Übersicht und klicken Sie auf die gewünschte
              Bestellung. Dort können Sie den Status ändern und Details bearbeiten.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Wie füge ich einen neuen Kunden hinzu?</h3>
            <p className="text-sm text-muted-foreground">
              In der Kundenverwaltung finden Sie den Button "Neuer Kunde". Füllen Sie
              das Formular aus und speichern Sie die Daten.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







