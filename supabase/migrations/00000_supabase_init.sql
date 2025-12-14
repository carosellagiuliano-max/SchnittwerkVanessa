-- ============================================
-- Supabase System Users Initialization
-- Sets passwords and permissions for Supabase services
-- ============================================

-- Set passwords for all Supabase system users
-- Note: These use the same password as POSTGRES_PASSWORD
ALTER ROLE supabase_auth_admin WITH PASSWORD 'postgres';
ALTER ROLE supabase_storage_admin WITH PASSWORD 'postgres';
ALTER ROLE authenticator WITH PASSWORD 'postgres';
ALTER ROLE supabase_admin WITH PASSWORD 'postgres';

-- Grant supabase_auth_admin ownership of auth schema and all its objects
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

-- Transfer ownership of all existing functions in auth schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT proname, pg_get_function_identity_arguments(p.oid) as args
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = 'auth'
  LOOP
    EXECUTE format('ALTER FUNCTION auth.%I(%s) OWNER TO supabase_auth_admin', r.proname, r.args);
  END LOOP;
END $$;

-- Transfer ownership of all tables in auth schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'auth'
  LOOP
    EXECUTE format('ALTER TABLE auth.%I OWNER TO supabase_auth_admin', r.tablename);
  END LOOP;
END $$;

-- Grant all privileges
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO supabase_auth_admin;

-- Create _realtime schema for realtime service
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT ALL ON SCHEMA _realtime TO supabase_admin;

-- Create graphql_public schema for PostgREST
CREATE SCHEMA IF NOT EXISTS graphql_public;
GRANT ALL ON SCHEMA graphql_public TO authenticator;
