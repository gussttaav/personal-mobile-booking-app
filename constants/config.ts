// Build-time environment. `EXPO_PUBLIC_*` values are inlined by Metro at bundle
// time (both `eas build` and `eas update`), so they must be referenced as
// literal `process.env.EXPO_PUBLIC_X` expressions — never via a computed key.
//
// Values live in EAS environment variables (`preview` / `production`
// environments) and are pulled in by the `environment` field on the matching
// eas.json build profile. All four are PUBLIC client-side values (a publishable
// Stripe key, a Supabase anon key, a hostname) — none is a secret.
//
// Dev builds fall back to staging. Release builds THROW instead of falling back:
// a production binary silently talking to staging with a test Stripe key is far
// worse than a loud crash the preview build catches first.
function fromEnv(value: string | undefined, name: string, devFallback: string): string {
  if (value) return value;
  if (__DEV__) return devFallback;
  throw new Error(
    `[config] Missing ${name}. Release builds must supply it — check the eas.json ` +
      `profile's "environment" and the EAS environment variables for it.`
  );
}

export const API_BASE = fromEnv(
  process.env.EXPO_PUBLIC_API_BASE,
  'EXPO_PUBLIC_API_BASE',
  'https://staging.gustavoai.dev'
);

export const STRIPE_PUBLISHABLE_KEY = fromEnv(
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'pk_test_51T7ZmQ35RmDZD7yYQK0xaxnuHglSh61bwhx64I1VDpC851fjrrAY3G5NnzZx3eJ3rLHXPed2IgYuZft0Vgm3uJDG007tSchQ4a'
);

export const SUPABASE_URL = fromEnv(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  'EXPO_PUBLIC_SUPABASE_URL',
  'https://lgfntdmrbzlvepngucyo.supabase.co'
);

export const SUPABASE_ANON_KEY = fromEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'sb_publishable_ZOVMNnQJR9wPpGsptsb_LQ_iSQb_r19'
);

export const GOOGLE_REVIEW_URL = 'https://g.page/r/CeUEcIsZXTyiEBM/review';

// Direct line to Gustavo — the fallback contact when an in-app action keeps
// failing (see lib/contact.ts). NOT an alternative to the 2h cancel/reschedule
// rule; that boundary has no override.
export const CONTACT_EMAIL = 'contacto@gustavoai.dev';

// Legal pages, per UI language (EN pages live under /en/…).
export const TERMS_URL = {
  es: 'https://gustavoai.dev/terminos',
  en: 'https://gustavoai.dev/en/terminos',
} as const;
export const PRIVACY_URL = {
  es: 'https://gustavoai.dev/privacidad',
  en: 'https://gustavoai.dev/en/privacidad',
} as const;
