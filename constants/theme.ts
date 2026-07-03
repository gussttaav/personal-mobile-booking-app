/**
 * GustavoAI — Emerald Nocturne design tokens
 * Source of truth: docs/design/design-system/colors_and_type.css
 *
 * Dark-only. No light palette.
 */

// ── Colors ──────────────────────────────────────────────────────────────────

export const Colors = {
  text:            '#e5e1e4',   // --text
  background:      '#131315',   // --bg
  tint:            '#4edea3',   // --green  (primary brand)
  icon:            '#86948a',   // --text-dim
  tabIconDefault:  '#86948a',   // --text-dim
  tabIconSelected: '#4edea3',   // --green

  // Surface hierarchy (darkest → brightest)
  surfaceLowest:    '#0e0e10',  // Layer -1
  surfaceLow:       '#1c1b1d',  // Layer 1 — sections
  surfaceContainer: '#201f22',  // Layer 2 — cards, inputs
  surfaceHigh:      '#2a2a2c',  // Elevated cards
  surfaceHighest:   '#353437',  // Floating, popovers
  surfaceBright:    '#39393b',  // Pressed states

  // Primary / Emerald
  primary:          '#4edea3',
  primaryContainer: '#10b981',
  onPrimary:        '#003824',
  primaryDim:       'rgba(78, 222, 163, 0.12)',
  primaryMid:       'rgba(78, 222, 163, 0.25)',

  // Text hierarchy
  textMuted: '#bbcabf',   // --text-muted  (secondary/body)
  textDim:   '#86948a',   // --text-dim    (placeholder/timestamps)

  // Secondary (desaturated green-grey)
  secondary:          '#9ed2b5',
  secondaryContainer: '#21523c',
  onSecondary:        '#013824',

  // Tertiary (soft coral)
  tertiary:          '#ffb3af',
  tertiaryContainer: '#fc7c78',
  onTertiary:        '#650911',

  // Status
  error:         '#ffb4ab',
  errorBg:       'rgba(255, 180, 171, 0.12)',
  errorBorder:   'rgba(255, 180, 171, 0.25)',
  warning:       '#fbbf24',
  warningBg:     'rgba(251, 191, 36, 0.12)',
  warningBorder: 'rgba(251, 191, 36, 0.25)',
  success:       '#4edea3',
  successBg:     'rgba(78, 222, 163, 0.10)',
  successBorder: 'rgba(78, 222, 163, 0.25)',

  // Borders
  border:        'rgba(255, 255, 255, 0.05)',  // hairline default
  borderVariant: '#3c4a42',                    // green-tinted structural

  // Inverse
  inverseSurface:   '#e5e1e4',
  inverseOnSurface: '#313032',

  // Outline
  outline:        '#86948a',
  outlineVariant: '#3c4a42',
};

// ── Font families ────────────────────────────────────────────────────────────
// Strings match the family name once expo-google-fonts packages are loaded.
// Until then RN uses the system sans-serif — screens won't break, just look plain.

export const FontFamily = {
  headline: 'Manrope',   // weights 600 700 800 — headings, stats, prices
  body:     'Inter',     // weights 300 400 500 600 — body, labels, UI
  mono:     'SpaceMono', // existing Expo template mono (replace when JetBrainsMono is added)
};

// ── Type scale ───────────────────────────────────────────────────────────────
// fontSize in dp; letterSpacing converted from em (e.g. -0.02em @ 34px → -0.68).
// lineHeight is absolute dp.

export const TypeScale = {
  display:  { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.68, lineHeight: 36 },
  h2:       { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.56, lineHeight: 32 },
  h3:       { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.18, lineHeight: 23 },
  h4:       { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.16, lineHeight: 21 },
  overline: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.1,   lineHeight: 15 },
  body:     { fontSize: 16, fontWeight: '400' as const,                        lineHeight: 26 },
  bodySm:   { fontSize: 15, fontWeight: '400' as const,                        lineHeight: 25 },
  label:    { fontSize: 14, fontWeight: '500' as const,                        lineHeight: 20 },
  caption:  { fontSize: 12, fontWeight: '400' as const,                        lineHeight: 18 },
  badge:    { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.6,   lineHeight: 10 },
  stat:     { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.84, lineHeight: 28 },
  price:    { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.64, lineHeight: 32 },
};

// ── Spacing ──────────────────────────────────────────────────────────────────
// Mirrors --space-* tokens (4 dp base unit).

export const Spacing = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
  8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
} as const;

// ── Border radius ────────────────────────────────────────────────────────────
// Mirrors --radius-* tokens from CSS.

export const Radius = {
  xs:    2,
  sm:    4,
  md:    6,
  lg:    8,
  xl:    10,
  '2xl': 12,
  '3xl': 14,
  '4xl': 16,
  '5xl': 18,
  full:  9999,
  default: 12,
} as const;
