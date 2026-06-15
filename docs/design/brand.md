# Brand Reference — gustavoai.dev

> Source of truth for the Emerald Nocturne design system.
> All values are extracted verbatim from code; no approximations.

---

## Colors

The palette is **dark-only** — no light-mode equivalent is defined anywhere in the codebase.
All tokens live in two places that must stay in sync:
- Tailwind tokens → `tailwind.config.js` lines 9-66
- CSS custom properties → `src/app/globals.css` lines 11-62
- JS constants → `src/constants/index.ts` lines 11-43

### Primary / Emerald

| Token | Hex | RGB | Intended use |
|---|---|---|---|
| `primary` / `--green` / `COLORS.brand` | `#4edea3` | rgb(78, 222, 163) | Primary CTA buttons, focus rings, active states, scrollbar hover, FAB background, user chat bubble, selection highlight |
| `primary-container` / `--green-container` / `COLORS.brandHover` | `#10b981` | rgb(16, 185, 129) | Hover state of primary buttons; chat send button hover |
| `on-primary` | `#003824` | rgb(0, 56, 36) | Text on top of `primary` background (chat user bubble text, send icon color) |
| `primary-fixed` | `#6ffbbe` | rgb(111, 251, 190) | *(defined, not yet used in components)* |
| `primary-fixed-dim` | `#4edea3` | rgb(78, 222, 163) | *(alias of primary)* |
| `surface-tint` | `#4edea3` | rgb(78, 222, 163) | *(Material You tint alias)* |
| `--green-dim` / `COLORS.brandMuted` | `rgba(78,222,163,0.12)` | — | Muted emerald fill: chat avatar bg, suggestion chip bg, success state bg |
| `--green-mid` / `COLORS.brandBorder` | `rgba(78,222,163,0.25)` | — | Emerald borders: skill tooltip border, chat panel border, suggestion chip border |
| `inverse-primary` | `#006c49` | rgb(0, 108, 73) | *(defined; inverse-surface context)* |

Defined at: `tailwind.config.js:11-17`, `src/app/globals.css:26-29`, `src/constants/index.ts:17-21`

### Secondary

| Token | Hex | RGB | Intended use |
|---|---|---|---|
| `secondary` | `#9ed2b5` | rgb(158, 210, 181) | *(defined; not yet prominent in UI)* |
| `secondary-container` | `#21523c` | rgb(33, 82, 60) | *(defined)* |
| `on-secondary` | `#013824` | rgb(1, 56, 36) | *(defined)* |
| `on-secondary-container` | `#91c4a8` | rgb(145, 196, 168) | *(defined)* |

Defined at: `tailwind.config.js:19-26`

### Tertiary (error-adjacent warm tone)

| Token | Hex | RGB | Intended use |
|---|---|---|---|
| `tertiary` | `#ffb3af` | rgb(255, 179, 175) | *(defined)* |
| `tertiary-container` | `#fc7c78` | rgb(252, 124, 120) | *(defined)* |

Defined at: `tailwind.config.js:28-35`

### Error / Status

| Token | Hex | RGB | Intended use |
|---|---|---|---|
| `error` / `--error` / `COLORS.error` | `#ffb4ab` | rgb(255, 180, 171) | Error text; chat FAB notification dot |
| `error-container` | `#93000a` | rgb(147, 0, 10) | Error container background |
| `on-error` | `#690005` | rgb(105, 0, 5) | Text on error surface |
| `on-error-container` | `#ffdad6` | rgb(255, 218, 214) | *(defined)* |
| `--error-bg` / `COLORS.errorBg` | `rgba(255,180,171,0.12)` | — | Translucent error highlight |
| `--warning` / `COLORS.warning` | `#fbbf24` | rgb(251, 191, 36) | Warning text |
| `--warning-bg` / `COLORS.warningBg` | `rgba(251,191,36,0.12)` | — | Translucent warning highlight |

Defined at: `tailwind.config.js:37-40`, `src/app/globals.css:45-48`, `src/constants/index.ts:31-38`

### Surface hierarchy

All surfaces are near-black. The system uses elevation to create depth — lighter surface = higher layer.

| Token | Hex | RGB | Layer / use |
|---|---|---|---|
| `surface-container-lowest` / `--surface-lowest` | `#0e0e10` | rgb(14, 14, 16) | Layer −1: deepest recesses |
| `background` / `surface` / `surface-dim` / `--bg` | `#131315` | rgb(19, 19, 21) | Layer 0: page background, body bg |
| `surface-container-low` / `--surface-low` | `#1c1b1d` | rgb(28, 27, 29) | Layer 1: sections, sidebar panels |
| `surface-container` / `--surface-container` | `#201f22` | rgb(32, 31, 34) | Layer 2: cards, inputs, bot chat bubbles |
| `surface-container-high` / `--surface-high` | `#2a2a2c` | rgb(42, 42, 44) | Layer 2.5: chat panel, hover states |
| `surface-container-highest` / `surface-variant` / `--surface-highest` | `#353437` | rgb(53, 52, 55) | Layer 3: floating elements, popovers, tooltips |
| `surface-bright` / `--surface-bright` | `#39393b` | rgb(57, 57, 59) | Bright surface (highlight, active) |
| `inverse-surface` | `#e5e1e4` | rgb(229, 225, 228) | Light inverse (e.g. snackbar) |
| `inverse-on-surface` | `#313032` | rgb(49, 48, 50) | Text on inverse surface |

Defined at: `tailwind.config.js:43-55`, `src/app/globals.css:12-23`

### Text

| Token | Hex | RGB | Use |
|---|---|---|---|
| `on-surface` / `on-background` / `--text` | `#e5e1e4` | rgb(229, 225, 228) | Body copy, headings, strong text |
| `on-surface-variant` / `--text-muted` | `#bbcabf` | rgb(187, 202, 191) | Secondary copy, descriptions, chat bot text |
| `outline` / `--text-dim` | `#86948a` | rgb(134, 148, 138) | Placeholder, hints, policy subheadings |
| `--color-text-body` *(legacy)* | `#c9d1de` | rgb(201, 209, 222) | Legacy alias — do not use in new code |

Defined at: `tailwind.config.js:59-61,64`, `src/app/globals.css:36-38`

### Borders

| Token | Value | Use |
|---|---|---|
| `--border` / `COLORS.border` | `rgba(255,255,255,0.05)` | Default hairline borders (cards, chat header/input dividers) |
| `outline-variant` / `--border-variant` | `#3c4a42` | Stronger border (bot message border, scrollbar thumb, skill tooltip arrow) |

Defined at: `tailwind.config.js:65`, `src/app/globals.css:41-42`

---

## Typography

### Font families

| Role | Family | Weights loaded | Source | CSS variable | Tailwind class |
|---|---|---|---|---|---|
| Headline | Manrope | 600, 700, 800 | Google Fonts (`next/font/google`) | `--font-headline` | `font-headline` |
| Body / UI / Label | Inter | 300, 400, 500, 600 | Google Fonts (`next/font/google`) | `--font-body` | `font-body`, `font-label` |
| Icons | Material Symbols Outlined | 100–700 (variable) | Self-hosted WOFF2 (`src/app/[locale]/fonts/`) | `--font-icon` | `.material-symbols-outlined` |

Loaded in: `src/app/[locale]/layout.tsx:27-49`

Both Google fonts use `display: swap` and `subsets: ["latin"]`. The icon font uses `display: block` (prevents FOUT for icons).

The `<html>` element gets all three variable classes; `<body>` gets `inter.className` as its default.

### Base body style

- `font-family`: `var(--font-body, "Inter")`, `system-ui`, `sans-serif` (`src/app/globals.css:71`)
- `font-weight`: `400` (`src/app/globals.css:72`)
- `line-height`: `1.65` (`src/app/globals.css:75`)
- `-webkit-font-smoothing`: `antialiased` (`src/app/globals.css:76`)

### Type scale observed in codebase

| Size | Tailwind step | Semantic role | Found in |
|---|---|---|---|
| 10px | `text-[10px]` | Caption / hint overlay | `.skill-hint` (globals.css:187) |
| 11px | — | Status indicators, meta labels | `.chat-header-status` (globals.css:375), policy `h3` (globals.css:684) |
| 12px | — | Chip labels, tooltip body, expanded chat | `.chat-suggestion` (globals.css:564), `.skill-tooltip` (globals.css:209) |
| 13px | — | Primary chat UI, skill items, nav | `.chat-msg` (globals.css:450), `.skill-item` (globals.css:164) |
| 14px | `text-sm` | Policy body, expanded chat | `.policy-body` (globals.css:678), `.chat-panel--expanded .chat-msg` (globals.css:651) |
| 14.5px | — | Policy body text | `.policy-body` (globals.css:678) |
| 16px | `text-base` | Default icon size | `.material-symbols-outlined` (globals.css:119) |
| 24px | — | Default icon display size | `.material-symbols-outlined` icon size (globals.css:120) |

Heading sizes and body Tailwind steps (`text-lg`, `text-xl`, `text-2xl`, etc.) follow Tailwind defaults and are applied directly in component JSX — no custom scale is defined.

### Line-height conventions

| Context | Value |
|---|---|
| Body default | `1.65` (globals.css:75) |
| Chat messages | `1.55` (globals.css:452) |
| Policy body | `1.8` (globals.css:679) |
| Skill tooltip | `1.55` (globals.css:210) |
| Icon | `1` (globals.css:121) |
| Chat header name | `1.2` (globals.css:368) |

### Font-weight conventions

| Weight | Usage |
|---|---|
| 300 | Available (loaded); used for light body text |
| 400 | Default body, chat messages |
| 500 | Medium emphasis: headings in chat, badge text, strong in bot messages, pack names |
| 600 | Subheadings, button labels (Manrope/Inter shared) |
| 700 | Section headings |
| 800 | Hero display headlines (Manrope) |

### Overline / section-label pattern

```css
/* globals.css:683-689 */
font-size: 11px;
font-weight: 500;
letter-spacing: 0.08em;
text-transform: uppercase;
color: var(--text-dim);  /* #86948a */
```

Used consistently across the UI as section labels: "Sobre Gustavo", "Capacidades", "Áreas de Especialización".

---

## Spacing and layout

### Spacing scale

Tailwind default — no custom additions to `theme.extend.spacing`. All spacing uses Tailwind's built-in `rem`-based scale (4px base unit).

### Border radius

Defined in `tailwind.config.js:74-82` — **overrides Tailwind defaults entirely**.

| Token | Value | Use |
|---|---|---|
| `rounded` (DEFAULT) | `0.125rem` = **2px** | Sharp data elements; the sharpest choice is the default |
| `rounded-sm` | `0.25rem` = **4px** | — |
| `rounded-md` | `0.375rem` = **6px** | Buttons |
| `rounded-lg` | `0.5rem` = **8px** | Cards (standard) |
| `rounded-xl` | `0.75rem` = **12px** | Cards (prominent) |
| `rounded-2xl` | `1rem` = **16px** | Large containers |
| `rounded-full` | `9999px` | Pill / avatar / FAB / send button |

CSS also declares `--radius: 12px` (`src/app/globals.css:61`) as a standalone variable. The chat panel uses `border-radius: 18px` (globals.css:324) — a one-off larger radius not in the Tailwind scale.

### Notable container widths

No custom Tailwind `container` config. Responsive layout classes are defined in `src/app/globals.css`:

| Class | Breakpoint | Columns / padding |
|---|---|---|
| `.landing-column` | `<640px` | `padding: 0 16px 80px` |
| `.landing-column` | `≥640px` | `padding: 0 24px 80px` |
| `.landing-column` | `≥768px` | `padding: 0 32px 80px` |
| `.sessions-grid` | `<768px` → `≥768px` | 1 col → 3 col |
| `.packs-grid` | `<768px` → `≥768px` | 1 col → 2 col |
| `.specs-grid` | `≥768px` | 12-col grid |
| `.footer-grid` | mobile → `≥560px` → `≥768px` | 1 → 2 → `2fr 1fr 1fr 1fr` |
| `.chat-panel` | default | `width: 340px`, `height: 530px` |
| `.chat-panel--expanded` | default | `min(90vw, 800px)` × `min(85vh, 700px)` |

---

## Effects

### Shadow tokens

Defined in `tailwind.config.js:84-91`.

| Token | Value | Use |
|---|---|---|
| `shadow-elevation-sm` | `0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)` | Low-lift cards |
| `shadow-elevation-md` | `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)` | Standard card elevation |
| `shadow-elevation-lg` | `0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)` | Modals, drawers |
| `shadow-glow-primary` | `0 0 30px rgba(78,222,163,0.4)` | Emerald glow (FAB, key CTA) |
| `shadow-glow-primary-lg` | `0 20px 60px -15px rgba(78,222,163,0.5)` | Hero-level emerald glow |

Each elevation shadow pairs depth with a subtle white box-ring (`0 0 0 1px rgba(255,255,255,0.04-0.05)`) that lifts the element edge against the dark background without an explicit border.

### Hero gradient orb

```css
/* body::before — src/app/globals.css:82-93 */
background: radial-gradient(
  circle at 50% -20%,
  rgba(78, 222, 163, 0.15) 0%,
  rgba(19, 19, 21, 0) 60%
);
width: 100%; height: 90vh;
position: fixed; pointer-events: none; z-index: 0;
```

Creates the signature emerald glow at the top of every page.

### Grid texture

```css
/* body::after — src/app/globals.css:95-106 */
background-image:
  linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
background-size: 60px 60px;
position: fixed; inset: 0; pointer-events: none; z-index: 0;
```

Very subtle dot-grid texture at 1.2% white opacity, full-page.

### Border conventions

- Default borders: `rgba(255,255,255,0.05)` — almost invisible hairlines.
- Emerald-context accent borders: `rgba(78,222,163,0.2–0.3)`.
- Stronger structural borders: `--border-variant` (`#3c4a42`).
- Focus ring: `outline: 2px solid var(--green); outline-offset: 2px` (globals.css:109-111).

### Scrollbar

```css
/* src/app/globals.css:138-141 */
width: 6px;
track: transparent;
thumb: #3c4a42 (--border-variant) → #4edea3 (--green) on hover;
border-radius: 10px;
```

### Transitions / animations

Defined as Tailwind tokens in `tailwind.config.js:93-112`:

| Token | Value | Purpose |
|---|---|---|
| `animate-fadeUp` | `fadeUp 0.6s ease both` | Elements entering from below (translateY 20px → 0) |
| `animate-fadeIn` | `fadeIn 0.4s ease both` | Opacity-only fade entrance |
| `animate-skeleton` | `skeletonPulse 1.4s ease-in-out infinite` | Loading skeleton pulse (opacity 1 → 0.45 → 1) |

Additional CSS-only animations (not Tailwind tokens):

| Name | Duration | Purpose |
|---|---|---|
| `chat-dot-pulse` | `2s ease-in-out infinite` | FAB notification dot breathe (scale 1 → 1.2) |
| `chat-typing-bounce` | `1.4s infinite` (staggered +0.2s, +0.4s) | Typing indicator dots bounce |

Standard transition durations across interactive elements: `0.15s` (micro), `0.18–0.2s` (standard hover/reveal), `0.22s` (panel open/close), `0.25s` (FAB scale).

---

## Tone and voice

**Languages:** Spanish (default, unprefixed URLs) and English (`/en`). UI text is fully bilingual via `next-intl`; the admin panel remains Spanish-only (hardcoded is acceptable there per CLAUDE.md).

**Formality:** Semi-formal. Direct address, first person ("acompaño", "me dediqué"), no slang. Professional without being stiff.

**Signature copy patterns:**
- Short, punchy taglines with a contrasting second clause:
  - ES: *"Entiende de verdad lo que la IA solo resume."*
  - EN: *"Truly understand what AI only summarizes."*
- Subheading as a quick negative strike-list: *"Clases individuales. Sin videos, sin prompts, sin perder el tiempo."*
- Social proof via exact numbers: "4.700 clases", "150+ valoraciones", "4.9/5"
- Pack names signal aspiration within reach: "Pack Esencial", "Pack Intensivo"
- Overline labels in uppercase/small-caps: "Sobre Gustavo", "Capacidades", "Áreas de Especialización"
- Bio uses literary framing: *"Forjado entre código y ecuaciones"* / *"Forged between code and equations"*

---

## Personality

**Precise · Technical · Credible · Focused · Premium**

The 2px default border radius, exact social proof numbers, monochromatic dark base with a single emerald accent, and copy that leads with credentials over warmth all signal a system built for a technically sophisticated audience who values substance over style. The glow effects and emerald palette add a modern/premium edge without breaking the data-forward austerity.
