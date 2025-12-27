// Environment Configuration with validation

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

export const env = {
  // App
  appUrl: getEnvVar('NEXT_PUBLIC_APP_URL', false) || 'http://localhost:3000',
  appEnv: getEnvVar('NEXT_PUBLIC_APP_ENV', false) || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Supabase (not required at build time for Docker compatibility)
  supabaseUrl: getEnvVar('NEXT_PUBLIC_SUPABASE_URL', false),
  supabaseAnonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', false),
  supabaseServiceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY', false),

  // Stripe
  stripePublishableKey: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', false),
  stripeSecretKey: getEnvVar('STRIPE_SECRET_KEY', false),
  stripeWebhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET', false),

  // Email
  resendApiKey: getEnvVar('RESEND_API_KEY', false),
  emailFrom: getEnvVar('EMAIL_FROM', false) || 'noreply@schnittwerk.ch',

} as const;
