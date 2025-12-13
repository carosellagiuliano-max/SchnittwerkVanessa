-- ============================================
-- 00021: SMS Reminders & Notification Tracking
-- SCHNITTWERK Phase 8 - Notification System
-- ============================================

-- ============================================
-- 1. APPOINTMENT REMINDERS TABLE
-- Track which reminders have been sent
-- ============================================

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type VARCHAR(10) NOT NULL CHECK (reminder_type IN ('24h', '1h', 'custom')),
  channel VARCHAR(10) NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'push')),
  message_id VARCHAR(100), -- External ID from Twilio/SendGrid
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate reminders
  CONSTRAINT unique_appointment_reminder
    UNIQUE (appointment_id, reminder_type, channel)
);

-- Index for querying by appointment
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment
ON appointment_reminders(appointment_id);

-- Index for status tracking
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_status
ON appointment_reminders(status) WHERE status != 'delivered';

-- ============================================
-- 2. NOTIFICATION LOGS TABLE
-- Central log for all notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id),
  customer_id UUID REFERENCES customers(id),

  -- Notification details
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'email', 'push')),
  event_type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL, -- Phone or email (masked)

  -- External tracking
  external_id VARCHAR(100), -- Twilio MessageSid, etc.

  -- Status tracking
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'undelivered')),

  -- Content (for debugging/audit)
  template_id VARCHAR(50),
  content_preview VARCHAR(160), -- First 160 chars

  -- Error tracking
  error_code VARCHAR(20),
  error_message TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Costs (for SMS billing tracking)
  segments INTEGER DEFAULT 1,
  cost_cents INTEGER -- Cost in cents
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_customer
ON notification_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_salon
ON notification_logs(salon_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_event
ON notification_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at
ON notification_logs(sent_at DESC);

-- ============================================
-- 3. NOTIFICATION PREFERENCES TABLE
-- Customer preferences for notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Channel preferences
  sms_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,

  -- Reminder preferences
  reminder_24h BOOLEAN DEFAULT true,
  reminder_1h BOOLEAN DEFAULT true,

  -- Marketing preferences
  marketing_emails BOOLEAN DEFAULT false,
  marketing_sms BOOLEAN DEFAULT false,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_customer_preferences
    UNIQUE (customer_id)
);

-- ============================================
-- 4. SMS TEMPLATES TABLE
-- Customizable SMS templates per salon
-- ============================================

CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id),

  -- Template identification
  event_type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,

  -- Template content
  template TEXT NOT NULL,

  -- Settings
  enabled BOOLEAN DEFAULT true,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either global (salon_id NULL) or per-salon
  CONSTRAINT unique_salon_template
    UNIQUE (salon_id, event_type)
);

-- Insert default templates
INSERT INTO sms_templates (salon_id, event_type, name, template) VALUES
(NULL, 'appointment_confirmed', 'Terminbestätigung',
  'Hallo {{customerName}}, Ihr Termin bei SCHNITTWERK wurde bestätigt: {{date}} um {{time}} Uhr ({{serviceName}} mit {{staffName}}). Wir freuen uns auf Sie!'),
(NULL, 'appointment_reminder_24h', 'Terminerinnerung (24h)',
  'Hallo {{customerName}}, zur Erinnerung: Morgen um {{time}} Uhr haben Sie einen Termin bei SCHNITTWERK ({{serviceName}}). Bis morgen!'),
(NULL, 'appointment_reminder_1h', 'Terminerinnerung (1h)',
  'Hallo {{customerName}}, in einer Stunde beginnt Ihr Termin bei SCHNITTWERK ({{serviceName}} mit {{staffName}}). Wir erwarten Sie!'),
(NULL, 'appointment_cancelled', 'Termin abgesagt',
  'Hallo {{customerName}}, Ihr Termin am {{date}} um {{time}} bei SCHNITTWERK wurde storniert. Bei Fragen kontaktieren Sie uns gerne.'),
(NULL, 'appointment_no_show', 'Verpasster Termin',
  'Hallo {{customerName}}, leider haben Sie Ihren Termin am {{date}} verpasst. Bitte kontaktieren Sie uns für einen neuen Termin.'),
(NULL, 'appointment_rescheduled', 'Termin verschoben',
  'Hallo {{customerName}}, Ihr Termin wurde verschoben auf: {{date}} um {{time}} Uhr ({{serviceName}}). Bis dann!'),
(NULL, 'order_confirmed', 'Bestellung bestätigt',
  'Hallo {{customerName}}, Ihre Bestellung #{{orderNumber}} über CHF {{totalAmount}} wurde bestätigt. Vielen Dank!'),
(NULL, 'loyalty_tier_upgrade', 'Loyalty-Stufe Upgrade',
  'Herzlichen Glückwunsch {{customerName}}! Sie sind jetzt {{newTier}}-Mitglied bei SCHNITTWERK und erhalten {{discount}} Rabatt!'),
(NULL, 'waitlist_available', 'Warteliste: Platz frei',
  'Gute Nachricht {{customerName}}! Am {{date}} um {{time}} ist ein Termin für {{serviceName}} frei geworden. Jetzt buchen: {{bookingLink}}')
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- Appointment Reminders: Admin can view all for their salon
CREATE POLICY "Admin can view appointment reminders"
ON appointment_reminders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN staff s ON s.id = a.staff_id
    WHERE a.id = appointment_reminders.appointment_id
    AND s.salon_id IN (
      SELECT salon_id FROM staff WHERE profile_id = auth.uid()
    )
  )
);

-- Notification Logs: Admin can view for their salon
CREATE POLICY "Admin can view notification logs"
ON notification_logs FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Notification Preferences: Users can manage their own
CREATE POLICY "Users can manage own preferences"
ON notification_preferences FOR ALL
TO authenticated
USING (
  profile_id = auth.uid()
);

-- SMS Templates: Admin can manage salon templates
CREATE POLICY "Admin can manage SMS templates"
ON sms_templates FOR ALL
TO authenticated
USING (
  salon_id IS NULL OR
  salon_id IN (
    SELECT s.salon_id FROM staff s
    JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
    WHERE s.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager')
  )
);

-- ============================================
-- 6. TRIGGER FOR PREFERENCE UPDATES
-- ============================================

CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_preferences_updated
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_timestamp();

-- ============================================
-- 7. ANALYTICS VIEW
-- ============================================

CREATE OR REPLACE VIEW notification_analytics AS
SELECT
  salon_id,
  channel,
  event_type,
  DATE(sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(segments) as avg_segments,
  SUM(cost_cents) as total_cost_cents
FROM notification_logs
GROUP BY salon_id, channel, event_type, DATE(sent_at);

COMMENT ON TABLE appointment_reminders IS 'Tracks sent appointment reminders to prevent duplicates';
COMMENT ON TABLE notification_logs IS 'Central log for all notification activity';
COMMENT ON TABLE notification_preferences IS 'Customer notification channel preferences';
COMMENT ON TABLE sms_templates IS 'Customizable SMS templates per event type';
