-- ============================================
-- SCHNITTWERK Database Seed Data
-- For development and testing only
-- ============================================

-- Note: This seed file assumes migrations have been run.
-- It creates test data for the SCHNITTWERK salon in St. Gallen.

-- ============================================
-- 0. CREATE ADMIN USER
-- ============================================

-- Create admin user in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  aud,
  role
) VALUES (
  'a50e8400-e29b-41d4-a716-446655440001',
  '00000000-0000-0000-0000-000000000000',
  'admin@schnittwerk.ch',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Admin", "last_name": "Schnittwerk"}',
  false,
  'authenticated',
  'authenticated'
);

-- Create identity for the user
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  created_at,
  updated_at
) VALUES (
  'a50e8400-e29b-41d4-a716-446655440001',
  'a50e8400-e29b-41d4-a716-446655440001',
  'admin@schnittwerk.ch',
  '{"sub": "a50e8400-e29b-41d4-a716-446655440001", "email": "admin@schnittwerk.ch"}',
  'email',
  NOW(),
  NOW()
);

-- ============================================
-- 1. CREATE SALON
-- ============================================

INSERT INTO salons (id, name, slug, address, zip_code, city, country, phone, email, website, timezone, currency, default_vat_rate, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'SCHNITTWERK by Vanessa Carosella',
  'schnittwerk',
  'Felsenstrasse 16a',
  '9000',
  'St. Gallen',
  'Schweiz',
  '+41 71 222 81 82',
  'info@schnittwerk.ch',
  'https://schnittwerk.ch',
  'Europe/Zurich',
  'CHF',
  8.1,
  true
);

-- ============================================
-- 2. CREATE OPENING HOURS
-- ============================================

INSERT INTO opening_hours (salon_id, day_of_week, open_time, close_time, is_open) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 0, '08:30', '18:00', true),  -- Monday
  ('550e8400-e29b-41d4-a716-446655440001', 1, '08:30', '18:00', true),  -- Tuesday
  ('550e8400-e29b-41d4-a716-446655440001', 2, '08:30', '18:00', true),  -- Wednesday
  ('550e8400-e29b-41d4-a716-446655440001', 3, '08:30', '20:00', true),  -- Thursday (late)
  ('550e8400-e29b-41d4-a716-446655440001', 4, '08:30', '18:00', true),  -- Friday
  ('550e8400-e29b-41d4-a716-446655440001', 5, '09:00', '14:00', true),  -- Saturday
  ('550e8400-e29b-41d4-a716-446655440001', 6, '00:00', '23:59', false); -- Sunday (closed)

-- ============================================
-- 3. CREATE SERVICE CATEGORIES
-- ============================================

INSERT INTO service_categories (id, salon_id, name, slug, description, sort_order) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Haarschnitte', 'haarschnitte', 'Schneiden, Stylen und Formen', 1),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Colorationen', 'colorationen', 'Färben, Strähnchen und Tönungen', 2),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Behandlungen', 'behandlungen', 'Pflege und Wellness für Ihre Haare', 3),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Styling', 'styling', 'Hochsteckfrisuren und Event-Styling', 4);

-- ============================================
-- 4. CREATE SERVICES
-- ============================================

-- Haarschnitte
INSERT INTO services (id, salon_id, category_id, name, slug, description, duration_minutes, price_cents, price_from, has_length_variants, is_bookable_online, sort_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Damen Haarschnitt', 'damen-haarschnitt', 'Waschen, Schneiden, Föhnen', 60, 7500, true, true, true, 1),
  ('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Herren Haarschnitt', 'herren-haarschnitt', 'Waschen, Schneiden, Styling', 30, 4500, false, false, true, 2),
  ('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Kinder Haarschnitt', 'kinder-haarschnitt', 'Für Kinder bis 12 Jahre', 30, 3500, false, false, true, 3),
  ('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'Pony schneiden', 'pony-schneiden', 'Nur Pony nachschneiden', 15, 1500, false, false, true, 4);

-- Length variants for Damen Haarschnitt
INSERT INTO service_length_variants (id, service_id, name, description, duration_minutes, price_cents, sort_order) VALUES
  ('760e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Kurz', 'Kurzhaarschnitt', 45, 7500, 1),
  ('760e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'Mittel', 'Schulterlang', 60, 8500, 2),
  ('760e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 'Lang', 'Lange Haare', 75, 9500, 3);

-- Colorationen
INSERT INTO services (id, salon_id, category_id, name, slug, description, duration_minutes, price_cents, price_from, is_bookable_online, sort_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Ansatzfärbung', 'ansatzfaerbung', 'Nachwuchs kaschieren', 60, 6500, true, true, 1),
  ('750e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Komplettfärbung', 'komplettfaerbung', 'Gesamte Haarfärbung', 90, 9500, true, true, 2),
  ('750e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Strähnchen', 'straehnchen', 'Highlights und Lowlights', 120, 12000, true, true, 3),
  ('750e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002', 'Balayage', 'balayage', 'Natürlicher Farbverlauf', 150, 18000, true, true, 4);

-- Behandlungen
INSERT INTO services (id, salon_id, category_id, name, slug, description, duration_minutes, price_cents, is_bookable_online, sort_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Intensivpflege', 'intensivpflege', 'Tiefenpflege für strapaziertes Haar', 30, 3500, true, 1),
  ('750e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Kopfmassage', 'kopfmassage', 'Entspannende Kopfhautmassage', 15, 2000, true, 2),
  ('750e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003', 'Olaplex Behandlung', 'olaplex', 'Reparatur und Stärkung', 45, 5000, true, 3);

-- Styling
INSERT INTO services (id, salon_id, category_id, name, slug, description, duration_minutes, price_cents, is_bookable_online, sort_order) VALUES
  ('750e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440004', 'Brautstyling', 'brautstyling', 'Komplettes Brautstyling mit Probe', 180, 35000, true, 1),
  ('750e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440004', 'Hochsteckfrisur', 'hochsteckfrisur', 'Elegante Hochsteckfrisur', 60, 8500, true, 2),
  ('750e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440004', 'Föhnen / Glätten', 'foehnen-glaetten', 'Professionelles Styling', 30, 3500, true, 3);

-- ============================================
-- 5. CREATE ADDON SERVICES
-- ============================================

INSERT INTO addon_services (id, salon_id, name, description, duration_minutes, price_cents, sort_order) VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Ansatzfärbung dazu', 'Ansatz mitfärben', 30, 4500, 1),
  ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Pflege-Treatment', 'Zusätzliche Haarpflege', 15, 2500, 2),
  ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Augenbrauen zupfen', 'Augenbrauen in Form bringen', 10, 1500, 3);

-- ============================================
-- 6. CREATE PRODUCT CATEGORIES
-- ============================================

INSERT INTO product_categories (id, salon_id, name, slug, description, sort_order) VALUES
  ('850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Shampoo', 'shampoo', 'Reinigung für jeden Haartyp', 1),
  ('850e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Conditioner', 'conditioner', 'Pflege und Spülung', 2),
  ('850e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'Styling', 'styling', 'Styling-Produkte', 3),
  ('850e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'Behandlung', 'behandlung', 'Intensivpflege', 4),
  ('850e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'Gutscheine', 'gutscheine', 'Geschenkgutscheine', 5);

-- ============================================
-- 7. CREATE PRODUCTS
-- ============================================

INSERT INTO products (id, salon_id, category_id, name, slug, description, brand, sku, price_cents, stock_quantity, is_featured, sort_order) VALUES
  ('950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'Repair Shampoo', 'repair-shampoo', 'Regenerierendes Shampoo für strapaziertes Haar', 'Kérastase', 'KER-SH-001', 3200, 15, true, 1),
  ('950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440001', 'Color Shampoo', 'color-shampoo', 'Farbschutz-Shampoo für coloriertes Haar', 'Kérastase', 'KER-SH-002', 2900, 12, false, 2),
  ('950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440002', 'Hydra Conditioner', 'hydra-conditioner', 'Feuchtigkeitsspendende Spülung', 'Kérastase', 'KER-CO-001', 3400, 10, true, 1),
  ('950e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440003', 'Styling Cream', 'styling-cream', 'Leichte Styling-Creme für Definition', 'Kérastase', 'KER-ST-001', 2800, 8, false, 1),
  ('950e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440003', 'Haarspray Strong', 'haarspray-strong', 'Starker Halt für Styling', 'Kérastase', 'KER-ST-002', 2500, 20, true, 2),
  ('950e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440004', 'Olaplex No. 3', 'olaplex-no3', 'Hair Perfector für zuhause', 'Olaplex', 'OLA-003', 2900, 25, true, 1);

-- ============================================
-- 8. CREATE LOYALTY PROGRAM
-- ============================================

INSERT INTO loyalty_programs (id, salon_id, name, description, points_per_chf, points_value_cents, birthday_bonus_points) VALUES
  ('a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'SCHNITTWERK Treuepunkte', 'Sammeln Sie Punkte bei jedem Besuch und profitieren Sie von exklusiven Vorteilen.', 1, 1, 100);

-- Loyalty Tiers
INSERT INTO loyalty_tiers (id, program_id, name, description, min_points, points_multiplier, discount_percent, sort_order) VALUES
  ('a60e8400-e29b-41d4-a716-446655440001', 'a50e8400-e29b-41d4-a716-446655440001', 'Bronze', 'Willkommen im Treueprogramm', 0, 1.00, 0, 1),
  ('a60e8400-e29b-41d4-a716-446655440002', 'a50e8400-e29b-41d4-a716-446655440001', 'Silber', 'Treue zahlt sich aus', 500, 1.25, 5, 2),
  ('a60e8400-e29b-41d4-a716-446655440003', 'a50e8400-e29b-41d4-a716-446655440001', 'Gold', 'VIP-Status erreicht', 1500, 1.50, 10, 3);

-- ============================================
-- 9. CREATE NOTIFICATION TEMPLATES
-- ============================================

INSERT INTO notification_templates (salon_id, name, code, channel, subject, body_html, available_variables) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Terminbestätigung', 'appointment_confirmation', 'email',
   'Ihre Terminbestätigung bei SCHNITTWERK',
   '<h1>Hallo {{customer_name}},</h1><p>Ihr Termin bei SCHNITTWERK wurde bestätigt:</p><p><strong>Datum:</strong> {{appointment_date}}<br><strong>Uhrzeit:</strong> {{appointment_time}}<br><strong>Service:</strong> {{service_name}}</p><p>Wir freuen uns auf Ihren Besuch!</p><p>Ihr SCHNITTWERK Team</p>',
   '["customer_name", "appointment_date", "appointment_time", "service_name"]'::jsonb),

  ('550e8400-e29b-41d4-a716-446655440001', 'Terminerinnerung', 'appointment_reminder', 'email',
   'Erinnerung: Ihr Termin morgen bei SCHNITTWERK',
   '<h1>Hallo {{customer_name}},</h1><p>Wir möchten Sie an Ihren morgigen Termin erinnern:</p><p><strong>Datum:</strong> {{appointment_date}}<br><strong>Uhrzeit:</strong> {{appointment_time}}</p><p>Falls Sie den Termin nicht wahrnehmen können, bitten wir um rechtzeitige Absage (mind. 24h vorher).</p><p>Bis bald!</p><p>Ihr SCHNITTWERK Team</p>',
   '["customer_name", "appointment_date", "appointment_time"]'::jsonb),

  ('550e8400-e29b-41d4-a716-446655440001', 'Bestellbestätigung', 'order_confirmation', 'email',
   'Ihre Bestellung bei SCHNITTWERK #{{order_number}}',
   '<h1>Vielen Dank für Ihre Bestellung, {{customer_name}}!</h1><p>Ihre Bestellnummer: <strong>{{order_number}}</strong></p><p>Gesamtbetrag: {{total_chf}} CHF</p><p>Wir werden uns bei Ihnen melden, sobald Ihre Bestellung zur Abholung bereit ist.</p><p>Ihr SCHNITTWERK Team</p>',
   '["customer_name", "order_number", "total_chf"]'::jsonb),

  ('550e8400-e29b-41d4-a716-446655440001', 'Gutschein erhalten', 'voucher_received', 'email',
   'Sie haben einen Gutschein von SCHNITTWERK erhalten!',
   '<h1>{{recipient_name}},</h1><p>Sie haben einen Gutschein im Wert von <strong>{{voucher_value}} CHF</strong> erhalten!</p><p>{{personal_message}}</p><p>Ihr Gutscheincode: <strong>{{voucher_code}}</strong></p><p>Wir freuen uns auf Ihren Besuch bei SCHNITTWERK!</p>',
   '["recipient_name", "voucher_value", "voucher_code", "personal_message"]'::jsonb);

-- ============================================
-- 10. CREATE DEFAULT SETTINGS
-- ============================================

INSERT INTO settings (salon_id, key, value, category, description, is_public) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'booking_lead_time_hours', '1'::jsonb, 'booking', 'Mindestvorlaufzeit für Online-Buchungen in Stunden', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'booking_horizon_days', '90'::jsonb, 'booking', 'Wie viele Tage im Voraus kann gebucht werden', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'cancellation_cutoff_hours', '24'::jsonb, 'booking', 'Stornofrist vor Termin in Stunden', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'reservation_timeout_minutes', '15'::jsonb, 'booking', 'Timeout für temporäre Reservierungen', false),
  ('550e8400-e29b-41d4-a716-446655440001', 'shop_enabled', 'true'::jsonb, 'shop', 'Online-Shop aktiviert', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'shipping_enabled', 'true'::jsonb, 'shop', 'Versand aktiviert', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'shipping_cost_cents', '900'::jsonb, 'shop', 'Versandkosten in Rappen', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'free_shipping_threshold_cents', '10000'::jsonb, 'shop', 'Bestellwert für kostenlosen Versand', true);

-- ============================================
-- 11. CREATE DATA RETENTION POLICIES
-- ============================================

INSERT INTO data_retention_policies (salon_id, data_type, retention_days, action) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'customers_inactive', 1095, 'anonymize'),  -- 3 years
  ('550e8400-e29b-41d4-a716-446655440001', 'notifications', 365, 'delete'),            -- 1 year
  ('550e8400-e29b-41d4-a716-446655440001', 'audit_logs', 2555, 'delete');              -- 7 years

-- ============================================
-- 12. CREATE STAFF MEMBERS (without auth link for demo)
-- ============================================

INSERT INTO staff (id, salon_id, profile_id, display_name, job_title, bio, specialties, is_bookable, is_active, sort_order, email, phone, role, color, employment_type) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, 'Vanessa Carosella', 'Inhaberin & Master Stylistin', 'Mit über 15 Jahren Erfahrung und einer Leidenschaft für innovative Farbtechniken ist Vanessa das Herz von SCHNITTWERK. Sie ist spezialisiert auf Balayage und Brautfrisuren.', ARRAY['Balayage', 'Colorationen', 'Brautfrisuren'], true, true, 1, 'vanessa@schnittwerk.ch', '+41 71 234 56 78', 'admin', '#e11d48', 'full_time'),
  ('b50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', NULL, 'Laura Meier', 'Senior Stylistin', 'Laura bringt kreative Energie ins Team. Ihre Stärke liegt in modernen Schnitttechniken und natürlichen Colorationen.', ARRAY['Haarschnitte', 'Strähnchen', 'Styling'], true, true, 2, 'laura@schnittwerk.ch', '+41 71 234 56 79', 'staff', '#3b82f6', 'full_time'),
  ('b50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', NULL, 'Marco Bianchi', 'Stylist', 'Marco ist unser Spezialist für Herrenfrisuren und Bartpflege. Mit präzisen Schnitten und einem Auge für Details sorgt er für den perfekten Look.', ARRAY['Herrenschnitte', 'Bartpflege', 'Fade Cuts'], true, true, 3, 'marco@schnittwerk.ch', '+41 71 234 56 80', 'staff', '#10b981', 'full_time'),
  ('b50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', NULL, 'Sophie Klein', 'Junior Stylistin', 'Als neuestes Teammitglied bringt Sophie frische Ideen und Enthusiasmus mit. Sie lernt schnell und hat ein besonderes Gespür für Kundenwünsche.', ARRAY['Damenschnitte', 'Föhntechniken', 'Pflege'], true, true, 4, 'sophie@schnittwerk.ch', '+41 71 234 56 81', 'staff', '#f59e0b', 'part_time');

-- ============================================
-- 13. CREATE STAFF WORKING HOURS
-- ============================================

-- Vanessa: Mo-Fr 08:30-18:00, Sa 09:00-14:00
INSERT INTO staff_working_hours (staff_id, day_of_week, start_time, end_time) VALUES
  ('b50e8400-e29b-41d4-a716-446655440001', 0, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 1, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 2, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 3, '08:30', '20:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 4, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440001', 5, '09:00', '14:00');

-- Laura: Di-Sa
INSERT INTO staff_working_hours (staff_id, day_of_week, start_time, end_time) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', 1, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440002', 2, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440002', 3, '08:30', '20:00'),
  ('b50e8400-e29b-41d4-a716-446655440002', 4, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440002', 5, '09:00', '14:00');

-- Marco: Mo, Mi-Fr
INSERT INTO staff_working_hours (staff_id, day_of_week, start_time, end_time) VALUES
  ('b50e8400-e29b-41d4-a716-446655440003', 0, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440003', 2, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440003', 3, '08:30', '20:00'),
  ('b50e8400-e29b-41d4-a716-446655440003', 4, '08:30', '18:00');

-- Sophie: Mo-Do
INSERT INTO staff_working_hours (staff_id, day_of_week, start_time, end_time) VALUES
  ('b50e8400-e29b-41d4-a716-446655440004', 0, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440004', 1, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440004', 2, '08:30', '18:00'),
  ('b50e8400-e29b-41d4-a716-446655440004', 3, '08:30', '20:00');

-- ============================================
-- 14. CREATE STAFF SERVICE SKILLS
-- ============================================

-- Vanessa can do all services
INSERT INTO staff_service_skills (staff_id, service_id)
SELECT 'b50e8400-e29b-41d4-a716-446655440001', id
FROM services WHERE salon_id = '550e8400-e29b-41d4-a716-446655440001';

-- Laura: Haarschnitte, Colorationen, Styling
INSERT INTO staff_service_skills (staff_id, service_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440010'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440011'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440012'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440031'),
  ('b50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440032');

-- Marco: Herren, Kinder
INSERT INTO staff_service_skills (staff_id, service_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440002'),
  ('b50e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440004');

-- Sophie: Basic Haarschnitte, Behandlungen
INSERT INTO staff_service_skills (staff_id, service_id) VALUES
  ('b50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440001'),
  ('b50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440003'),
  ('b50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440020'),
  ('b50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440021'),
  ('b50e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440032');

-- ============================================
-- DONE
-- ============================================
