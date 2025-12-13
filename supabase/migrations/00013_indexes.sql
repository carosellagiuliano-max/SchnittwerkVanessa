-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00013_indexes.sql
-- Description: Additional performance indexes
-- ============================================

-- Note: Most indexes are created inline with their tables.
-- This file adds additional composite and specialized indexes
-- for common query patterns.

-- ============================================
-- APPOINTMENTS - Common Query Patterns
-- ============================================

-- Staff calendar view: appointments for a staff member in a date range
CREATE INDEX IF NOT EXISTS idx_appointments_staff_calendar
ON appointments (staff_id, start_time, status)
WHERE status NOT IN ('cancelled');

-- Customer history: all appointments for a customer
CREATE INDEX IF NOT EXISTS idx_appointments_customer_history
ON appointments (customer_id, start_time DESC);

-- Dashboard stats: completed appointments this month
CREATE INDEX IF NOT EXISTS idx_appointments_completed_month
ON appointments (salon_id, completed_at)
WHERE status = 'completed';

-- Upcoming reminders: confirmed appointments needing reminders
CREATE INDEX IF NOT EXISTS idx_appointments_for_reminders
ON appointments (start_time)
WHERE status = 'confirmed';

-- ============================================
-- ORDERS - Common Query Patterns
-- ============================================

-- Customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_history
ON orders (customer_id, created_at DESC);

-- Unfulfilled orders (pending, paid)
CREATE INDEX IF NOT EXISTS idx_orders_unfulfilled
ON orders (salon_id, created_at)
WHERE status IN ('pending', 'paid');

-- Pickup orders
CREATE INDEX IF NOT EXISTS idx_orders_pickup
ON orders (salon_id, pickup_date)
WHERE shipping_method = 'pickup' AND status NOT IN ('cancelled', 'completed');

-- ============================================
-- PRODUCTS - Common Query Patterns
-- ============================================

-- Product search by name (requires pg_trgm extension)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Note: pg_trgm needs to be enabled at database level first
-- CREATE INDEX IF NOT EXISTS idx_products_name_search
-- ON products USING gin (name gin_trgm_ops);

-- Featured products
CREATE INDEX IF NOT EXISTS idx_products_featured
ON products (salon_id, sort_order)
WHERE is_featured = true AND is_active = true AND is_published = true;

-- Category listing
CREATE INDEX IF NOT EXISTS idx_products_category_list
ON products (category_id, sort_order)
WHERE is_active = true AND is_published = true;

-- ============================================
-- CUSTOMERS - Common Query Patterns
-- ============================================

-- Customer search by name
CREATE INDEX IF NOT EXISTS idx_customers_name_search
ON customers (salon_id, last_name text_pattern_ops, first_name text_pattern_ops);

-- Birthday this month (for birthday greetings)
CREATE INDEX IF NOT EXISTS idx_customers_birthday_month
ON customers (salon_id, birthday)
WHERE birthday IS NOT NULL AND is_active = true;

-- Inactive customers (no visit in X days)
CREATE INDEX IF NOT EXISTS idx_customers_inactive
ON customers (salon_id, last_visit_at)
WHERE is_active = true;

-- ============================================
-- STAFF - Common Query Patterns
-- ============================================

-- Bookable staff with services
CREATE INDEX IF NOT EXISTS idx_staff_bookable_active
ON staff (salon_id, sort_order)
WHERE is_active = true AND is_bookable = true;

-- ============================================
-- SERVICES - Common Query Patterns
-- ============================================

-- Services by category for booking
CREATE INDEX IF NOT EXISTS idx_services_booking
ON services (salon_id, category_id, sort_order)
WHERE is_active = true AND is_bookable_online = true;

-- Service duration lookup
CREATE INDEX IF NOT EXISTS idx_services_duration
ON services (id, duration_minutes, buffer_before_minutes, buffer_after_minutes)
WHERE is_active = true;

-- ============================================
-- PAYMENTS - Common Query Patterns
-- ============================================

-- Daily revenue aggregation
CREATE INDEX IF NOT EXISTS idx_payments_daily_revenue
ON payments (salon_id, succeeded_at, payment_method)
WHERE status = 'succeeded';

-- Stripe reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_stripe_reconcile
ON payments (stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================
-- VOUCHERS - Common Query Patterns
-- ============================================

-- Valid vouchers lookup
CREATE INDEX IF NOT EXISTS idx_vouchers_valid
ON vouchers (salon_id, UPPER(code))
WHERE is_active = true;

-- Expiring vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_expiring
ON vouchers (salon_id, valid_until)
WHERE is_active = true AND valid_until IS NOT NULL;

-- ============================================
-- LOYALTY - Common Query Patterns
-- ============================================

-- Top loyalty customers
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_top
ON customer_loyalty (program_id, lifetime_points DESC);

-- Points expiring soon
CREATE INDEX IF NOT EXISTS idx_loyalty_trans_expiring
ON loyalty_transactions (expires_at)
WHERE expires_at IS NOT NULL;

-- ============================================
-- NOTIFICATIONS - Common Query Patterns
-- ============================================

-- Notification queue processing
CREATE INDEX IF NOT EXISTS idx_notifications_queue
ON notifications (scheduled_for NULLS FIRST, created_at)
WHERE status = 'pending';

-- Failed notifications for retry
CREATE INDEX IF NOT EXISTS idx_notifications_failed_retry
ON notifications (created_at)
WHERE status = 'failed' AND retry_count < max_retries;

-- ============================================
-- AUDIT LOGS - Common Query Patterns
-- ============================================

-- Customer data access audit
CREATE INDEX IF NOT EXISTS idx_audit_customer_access
ON audit_logs (entity_id, created_at DESC)
WHERE entity_type = 'customer' AND action IN ('customer_view', 'customer_export');

-- Settings changes
CREATE INDEX IF NOT EXISTS idx_audit_settings
ON audit_logs (salon_id, created_at DESC)
WHERE action = 'settings_changed';

-- ============================================
-- FULL TEXT SEARCH INDEXES
-- ============================================

-- Product full text search
-- CREATE INDEX IF NOT EXISTS idx_products_fts
-- ON products USING gin (
--   to_tsvector('german', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, ''))
-- );

-- Customer full text search
-- CREATE INDEX IF NOT EXISTS idx_customers_fts
-- ON customers USING gin (
--   to_tsvector('german', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(notes, ''))
-- );

-- ============================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- ============================================

-- Only index active records in frequently queried tables
CREATE INDEX IF NOT EXISTS idx_services_active_only
ON services (salon_id, name)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_only
ON products (salon_id, name)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_customers_active_only
ON customers (salon_id, first_name, last_name)
WHERE is_active = true;

-- ============================================
-- BRIN INDEXES FOR TIME-SERIES DATA
-- (Efficient for append-only tables)
-- ============================================

-- Audit logs are append-only, BRIN is efficient
CREATE INDEX IF NOT EXISTS idx_audit_logs_brin
ON audit_logs USING brin (created_at);

-- Stock movements are append-only
CREATE INDEX IF NOT EXISTS idx_stock_movements_brin
ON stock_movements USING brin (created_at);

-- Loyalty transactions are append-only
CREATE INDEX IF NOT EXISTS idx_loyalty_trans_brin
ON loyalty_transactions USING brin (created_at);

-- ============================================
-- STATISTICS TARGETS
-- Increase statistics for frequently used columns
-- ============================================

ALTER TABLE appointments ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE appointments ALTER COLUMN start_time SET STATISTICS 500;
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
ALTER TABLE products ALTER COLUMN is_active SET STATISTICS 500;
ALTER TABLE customers ALTER COLUMN is_active SET STATISTICS 500;

-- ============================================
-- ANALYZE COMMAND
-- Run after data load to update statistics
-- ============================================
-- ANALYZE appointments;
-- ANALYZE orders;
-- ANALYZE products;
-- ANALYZE customers;
-- ANALYZE payments;
