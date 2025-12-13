-- ============================================
-- 00023: Marketing Automation & Customer Feedback
-- SCHNITTWERK Phase 8 - Marketing & Feedback Systems
-- ============================================

-- ============================================
-- 1. MARKETING LOGS TABLE
-- Track sent marketing campaigns
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Campaign details
  campaign_type VARCHAR(30) NOT NULL CHECK (campaign_type IN (
    'birthday', 'reengagement', 'welcome', 'post_visit', 'newsletter', 'custom'
  )),
  campaign_name VARCHAR(100),

  -- Channel
  channel VARCHAR(10) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'push')),

  -- Reference (e.g., appointment_id for post_visit)
  reference_type VARCHAR(30),
  reference_id UUID,

  -- Tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,

  -- Metadata
  subject TEXT,
  template_id VARCHAR(50),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_logs_salon
ON marketing_logs(salon_id);

CREATE INDEX IF NOT EXISTS idx_marketing_logs_customer
ON marketing_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_marketing_logs_type
ON marketing_logs(campaign_type);

CREATE INDEX IF NOT EXISTS idx_marketing_logs_sent_at
ON marketing_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_logs_reference
ON marketing_logs(reference_type, reference_id);

-- ============================================
-- 2. MARKETING CAMPAIGNS TABLE
-- Campaign configuration
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,

  -- Campaign info
  type VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Content
  subject TEXT NOT NULL,
  email_content TEXT,
  sms_content VARCHAR(320),

  -- Trigger configuration
  trigger_type VARCHAR(30) DEFAULT 'automatic' CHECK (trigger_type IN (
    'automatic', 'manual', 'scheduled'
  )),
  trigger_days INTEGER DEFAULT 0, -- Days before (-) or after (+) event

  -- Incentive
  discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
  voucher_value_cents INTEGER,
  voucher_code VARCHAR(50),

  -- Targeting
  target_segment VARCHAR(30) DEFAULT 'all' CHECK (target_segment IN (
    'all', 'new', 'inactive', 'vip', 'birthday'
  )),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Stats (cached)
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_salon
ON marketing_campaigns(salon_id);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_type
ON marketing_campaigns(type);

-- Trigger for updated_at
CREATE TRIGGER marketing_campaigns_updated_at
BEFORE UPDATE ON marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. CUSTOMER FEEDBACK TABLE
-- Store customer reviews and ratings
-- ============================================

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Reference
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,

  -- Rating (1-5 stars)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),

  -- Optional comment
  comment TEXT,

  -- Categories
  service_quality INTEGER CHECK (service_quality >= 1 AND service_quality <= 5),
  cleanliness INTEGER CHECK (cleanliness >= 1 AND cleanliness <= 5),
  wait_time INTEGER CHECK (wait_time >= 1 AND wait_time <= 5),
  value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),

  -- Response
  response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'hidden', 'flagged'
  )),

  -- Google Review tracking
  google_review_prompted BOOLEAN DEFAULT false,
  google_review_clicked BOOLEAN DEFAULT false,

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_feedback_salon
ON customer_feedback(salon_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer
ON customer_feedback(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_appointment
ON customer_feedback(appointment_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_staff
ON customer_feedback(staff_id);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating
ON customer_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_status
ON customer_feedback(status);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_submitted
ON customer_feedback(submitted_at DESC);

-- ============================================
-- 4. FEEDBACK REQUESTS TABLE
-- Track feedback request sending
-- ============================================

CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Request details
  channel VARCHAR(10) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- Token for secure feedback submission
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate requests per appointment
  CONSTRAINT unique_feedback_request_per_appointment
    UNIQUE (appointment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_requests_salon
ON feedback_requests(salon_id);

CREATE INDEX IF NOT EXISTS idx_feedback_requests_customer
ON feedback_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_feedback_requests_token
ON feedback_requests(token);

-- ============================================
-- 5. VIEWS FOR ANALYTICS
-- ============================================

-- Marketing campaign performance
CREATE OR REPLACE VIEW v_marketing_performance AS
SELECT
  ml.salon_id,
  ml.campaign_type,
  DATE(ml.sent_at) as date,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE ml.opened) as total_opened,
  COUNT(*) FILTER (WHERE ml.clicked) as total_clicked,
  COUNT(*) FILTER (WHERE ml.converted) as total_converted,
  ROUND(COUNT(*) FILTER (WHERE ml.opened)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as open_rate,
  ROUND(COUNT(*) FILTER (WHERE ml.clicked)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as click_rate,
  ROUND(COUNT(*) FILTER (WHERE ml.converted)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as conversion_rate
FROM marketing_logs ml
GROUP BY ml.salon_id, ml.campaign_type, DATE(ml.sent_at);

COMMENT ON VIEW v_marketing_performance IS 'Marketing campaign performance metrics';

-- Feedback summary
CREATE OR REPLACE VIEW v_feedback_summary AS
SELECT
  cf.salon_id,
  cf.staff_id,
  st.display_name as staff_name,
  COUNT(*) as total_reviews,
  ROUND(AVG(cf.rating), 2) as average_rating,
  COUNT(*) FILTER (WHERE cf.rating = 5) as five_star,
  COUNT(*) FILTER (WHERE cf.rating = 4) as four_star,
  COUNT(*) FILTER (WHERE cf.rating = 3) as three_star,
  COUNT(*) FILTER (WHERE cf.rating = 2) as two_star,
  COUNT(*) FILTER (WHERE cf.rating = 1) as one_star,
  ROUND(AVG(cf.service_quality), 2) as avg_service_quality,
  ROUND(AVG(cf.cleanliness), 2) as avg_cleanliness,
  ROUND(AVG(cf.value_for_money), 2) as avg_value_for_money
FROM customer_feedback cf
LEFT JOIN staff st ON cf.staff_id = st.id
WHERE cf.status = 'approved'
GROUP BY cf.salon_id, cf.staff_id, st.display_name;

COMMENT ON VIEW v_feedback_summary IS 'Customer feedback summary by salon and staff';

-- Recent feedback
CREATE OR REPLACE VIEW v_recent_feedback AS
SELECT
  cf.*,
  c.first_name || ' ' || c.last_name as customer_name,
  s.name as service_name,
  st.display_name as staff_name
FROM customer_feedback cf
JOIN customers c ON cf.customer_id = c.id
LEFT JOIN services s ON cf.service_id = s.id
LEFT JOIN staff st ON cf.staff_id = st.id
WHERE cf.submitted_at >= NOW() - INTERVAL '30 days'
ORDER BY cf.submitted_at DESC;

COMMENT ON VIEW v_recent_feedback IS 'Recent customer feedback with details';

-- ============================================
-- 6. FUNCTIONS
-- ============================================

-- Generate secure feedback token
CREATE OR REPLACE FUNCTION generate_feedback_token()
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create feedback request for appointment
CREATE OR REPLACE FUNCTION create_feedback_request(
  p_appointment_id UUID,
  p_channel VARCHAR DEFAULT 'email'
)
RETURNS UUID AS $$
DECLARE
  v_salon_id UUID;
  v_customer_id UUID;
  v_request_id UUID;
BEGIN
  -- Get appointment details
  SELECT salon_id, customer_id INTO v_salon_id, v_customer_id
  FROM appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Create request
  INSERT INTO feedback_requests (
    salon_id, appointment_id, customer_id, channel,
    token, expires_at
  ) VALUES (
    v_salon_id, p_appointment_id, v_customer_id, p_channel,
    generate_feedback_token(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (appointment_id) DO NOTHING
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Submit feedback by token
CREATE OR REPLACE FUNCTION submit_feedback_by_token(
  p_token VARCHAR,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_service_quality INTEGER DEFAULT NULL,
  p_cleanliness INTEGER DEFAULT NULL,
  p_wait_time INTEGER DEFAULT NULL,
  p_value_for_money INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_request feedback_requests%ROWTYPE;
  v_appointment appointments%ROWTYPE;
  v_feedback_id UUID;
BEGIN
  -- Get and validate request
  SELECT * INTO v_request
  FROM feedback_requests
  WHERE token = p_token
    AND expires_at > NOW()
    AND NOT completed
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired feedback token';
  END IF;

  -- Get appointment details
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = v_request.appointment_id;

  -- Create feedback
  INSERT INTO customer_feedback (
    salon_id, customer_id, appointment_id, staff_id, service_id,
    rating, comment, service_quality, cleanliness, wait_time, value_for_money
  ) VALUES (
    v_request.salon_id, v_request.customer_id, v_request.appointment_id,
    v_appointment.staff_id, v_appointment.service_id,
    p_rating, p_comment, p_service_quality, p_cleanliness, p_wait_time, p_value_for_money
  )
  RETURNING id INTO v_feedback_id;

  -- Mark request as completed
  UPDATE feedback_requests
  SET completed = true, completed_at = NOW()
  WHERE id = v_request.id;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE marketing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;

-- Marketing Logs: Staff can view their salon's logs
CREATE POLICY "Staff can view salon marketing logs"
ON marketing_logs FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Marketing Campaigns: Staff can manage their salon's campaigns
CREATE POLICY "Staff can manage salon campaigns"
ON marketing_campaigns FOR ALL
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

-- Customer Feedback: Customers can view/submit their own
CREATE POLICY "Customers can manage own feedback"
ON customer_feedback FOR ALL
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE profile_id = auth.uid()
  )
);

-- Customer Feedback: Staff can view salon feedback
CREATE POLICY "Staff can view salon feedback"
ON customer_feedback FOR SELECT
TO authenticated
USING (
  salon_id IN (
    SELECT salon_id FROM staff WHERE profile_id = auth.uid()
  )
);

-- Staff can respond to feedback
CREATE POLICY "Staff can respond to feedback"
ON customer_feedback FOR UPDATE
TO authenticated
USING (
  salon_id IN (
    SELECT s.salon_id FROM staff s
    JOIN user_roles ur ON ur.profile_id = s.profile_id AND ur.salon_id = s.salon_id
    WHERE s.profile_id = auth.uid()
    AND ur.role_name IN ('admin', 'manager')
  )
);

-- Feedback Requests: Service role only (system creates these)
CREATE POLICY "Service role can manage feedback requests"
ON feedback_requests FOR ALL
TO service_role
USING (true);

-- Allow token-based feedback submission (anonymous)
CREATE POLICY "Public can view feedback request by token"
ON feedback_requests FOR SELECT
TO anon
USING (token IS NOT NULL AND expires_at > NOW());

-- ============================================
-- 8. INSERT DEFAULT CAMPAIGNS
-- ============================================

INSERT INTO marketing_campaigns (salon_id, type, name, subject, email_content, trigger_type, trigger_days, discount_percent)
VALUES
  (NULL, 'birthday', 'Geburtstagsgruss', 'Alles Gute zum Geburtstag von SCHNITTWERK!',
   'Liebe/r {{firstName}}, wir wünschen Ihnen alles Gute zum Geburtstag!', 'automatic', 0, 10),
  (NULL, 'reengagement', 'Wir vermissen Sie', 'Wir vermissen Sie bei SCHNITTWERK!',
   'Liebe/r {{firstName}}, es ist schon eine Weile her seit Ihrem letzten Besuch.', 'automatic', 60, 5),
  (NULL, 'welcome', 'Willkommen', 'Willkommen bei SCHNITTWERK!',
   'Liebe/r {{firstName}}, herzlich willkommen bei SCHNITTWERK!', 'automatic', 1, NULL),
  (NULL, 'post_visit', 'Feedback-Anfrage', 'Wie war Ihr Besuch bei SCHNITTWERK?',
   'Liebe/r {{firstName}}, wir hoffen, Sie waren zufrieden mit unserem Service.', 'automatic', 1, NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. COMMENTS
-- ============================================

COMMENT ON TABLE marketing_logs IS 'Log of all sent marketing communications';
COMMENT ON TABLE marketing_campaigns IS 'Marketing campaign configurations';
COMMENT ON TABLE customer_feedback IS 'Customer reviews and ratings';
COMMENT ON TABLE feedback_requests IS 'Pending feedback requests with secure tokens';
COMMENT ON FUNCTION create_feedback_request IS 'Create a feedback request for a completed appointment';
COMMENT ON FUNCTION submit_feedback_by_token IS 'Submit feedback using a secure token';
