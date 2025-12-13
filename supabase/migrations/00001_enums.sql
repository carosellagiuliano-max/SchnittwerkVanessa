-- ============================================
-- SCHNITTWERK Database Schema
-- Migration: 00001_enums.sql
-- Description: All PostgreSQL ENUM types
-- ============================================

-- Appointment status enum
CREATE TYPE appointment_status AS ENUM (
  'reserved',     -- Temporarily held, awaiting payment/confirmation
  'requested',    -- Customer requested, awaiting staff approval
  'confirmed',    -- Confirmed and scheduled
  'cancelled',    -- Cancelled by customer or staff
  'completed',    -- Service was performed
  'no_show'       -- Customer did not appear
);

-- Order status enum
CREATE TYPE order_status AS ENUM (
  'pending',      -- Order created, awaiting payment
  'paid',         -- Payment received
  'shipped',      -- Order shipped (for delivery)
  'completed',    -- Order fulfilled
  'cancelled',    -- Order cancelled
  'refunded'      -- Order refunded
);

-- Payment method enum
CREATE TYPE payment_method AS ENUM (
  'stripe_card',       -- Online card payment via Stripe
  'stripe_twint',      -- Twint via Stripe (Switzerland)
  'cash',              -- Cash payment at venue
  'terminal',          -- Card terminal at venue
  'voucher',           -- Voucher/gift card
  'manual_adjustment'  -- Manual adjustment by admin
);

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',            -- Payment initiated
  'succeeded',          -- Payment successful
  'failed',             -- Payment failed
  'refunded',           -- Fully refunded
  'partially_refunded'  -- Partially refunded
);

-- Role name enum (RBAC)
CREATE TYPE role_name AS ENUM (
  'admin',        -- Full salon access
  'manager',      -- Operational access
  'mitarbeiter',  -- Staff access
  'kunde',        -- Customer access
  'hq'            -- Cross-salon access (headquarters)
);

-- Consent category enum (GDPR/DSG)
CREATE TYPE consent_category AS ENUM (
  'marketing_email',  -- Email marketing consent
  'marketing_sms',    -- SMS marketing consent
  'loyalty',          -- Loyalty program data processing
  'analytics'         -- Analytics tracking consent
);

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM (
  'email',  -- Email notifications
  'sms',    -- SMS notifications
  'push'    -- Push notifications (future)
);

-- Waitlist status enum
CREATE TYPE waitlist_status AS ENUM (
  'active',     -- Actively waiting
  'notified',   -- Customer was notified of availability
  'converted',  -- Converted to booking
  'cancelled',  -- Customer cancelled waitlist entry
  'expired'     -- Waitlist entry expired (past preferred date)
);

-- Blocked time type enum
CREATE TYPE blocked_time_type AS ENUM (
  'holiday',      -- Public holiday
  'vacation',     -- Staff vacation
  'sick',         -- Sick leave
  'maintenance',  -- Salon maintenance
  'other'         -- Other reason
);

-- Stock movement type enum
CREATE TYPE stock_movement_type AS ENUM (
  'purchase',     -- Purchased/received stock
  'sale',         -- Sold to customer
  'adjustment',   -- Manual adjustment
  'return',       -- Returned by customer
  'damaged',      -- Damaged/lost
  'transfer'      -- Transfer between locations
);

-- Audit action type enum
CREATE TYPE audit_action_type AS ENUM (
  'appointment_created',
  'appointment_updated',
  'appointment_cancelled',
  'appointment_no_show',
  'order_created',
  'order_updated',
  'order_refunded',
  'customer_created',
  'customer_updated',
  'customer_deleted',
  'customer_view',
  'customer_export',
  'orders_export',
  'appointments_export',
  'impersonation_start',
  'impersonation_end',
  'role_changed',
  'consent_changed',
  'settings_changed',
  'payment_processed',
  'payment_refunded'
);

-- Shipping method type enum
CREATE TYPE shipping_method_type AS ENUM (
  'shipping',  -- Physical delivery
  'pickup'     -- Pickup at salon
);

-- No-show policy enum
CREATE TYPE no_show_policy AS ENUM (
  'none',           -- No charge
  'charge_deposit', -- Charge deposit only
  'charge_full'     -- Charge full amount
);

COMMENT ON TYPE appointment_status IS 'Status of salon appointments';
COMMENT ON TYPE order_status IS 'Status of shop orders';
COMMENT ON TYPE payment_method IS 'Accepted payment methods';
COMMENT ON TYPE payment_status IS 'Status of payment transactions';
COMMENT ON TYPE role_name IS 'User roles for RBAC';
COMMENT ON TYPE consent_category IS 'GDPR/DSG consent categories';
COMMENT ON TYPE notification_channel IS 'Communication channels';
COMMENT ON TYPE waitlist_status IS 'Status of waitlist entries';
COMMENT ON TYPE blocked_time_type IS 'Types of blocked time periods';
COMMENT ON TYPE stock_movement_type IS 'Types of inventory movements';
COMMENT ON TYPE audit_action_type IS 'Types of auditable actions';
COMMENT ON TYPE shipping_method_type IS 'Types of shipping/delivery';
COMMENT ON TYPE no_show_policy IS 'Policy for no-show handling';
