# GustavoAI Design System — Emerald Nocturne

## Overview

**Product:** [gustavoai.dev](https://gustavoai.dev) — Personal tutoring platform for booking programming, mathematics, and AI classes.

**Owner:** Gustavo Torres Guerrero — Professor & Consultant with 15+ years of experience. Based in Spain (originally from Cuba). Teaches independently since 2020.

**Brand Identity:** A premium dark-mode personal brand site. The design system is named **"Emerald Nocturne"** — a deep charcoal/near-black dark foundation with a vivid emerald (#4edea3) primary accent. The aesthetic is technical, trustworthy, clean, and modern — inspired by high-end developer tooling and modern SaaS dashboards.

---

## Sources

- **Codebase:** `github.com/gussttaav/personal-tutoring-platform` (Next.js 14, TypeScript, Tailwind CSS)
  - Design tokens: `tailwind.config.js`, `src/app/globals.css`, `src/constants/index.ts`
  - Components: `src/components/ui/index.tsx`, `src/features/landing/`, `src/features/booking/`
  - Layout: `src/app/layout.tsx`, `src/app/page.tsx`
- **Live site:** https://gustavoai.dev

---

## Tech Context

- Next.js 14 App Router + TypeScript strict mode
- Styling: Tailwind CSS + CSS custom properties (`--font-headline`, `--font-body`, `--green`, `--bg`, etc.)
- Icons: **Material Symbols Outlined** (Google CDN, variable font)
- Fonts: **Manrope** (headlines 600/700/800) + **Inter** (body 300/400/500/600) — Google Fonts
- Language: Spanish (user-facing copy); English (code/comments)
- Auth: Google OAuth (NextAuth v5)
- Payments: Stripe
- Booking: Cal.com embed + Google Calendar API
- AI assistant: Google Gemini

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Language:** Spanish for all user-facing copy; formal but warm and direct.
- **Person:** Third-person about "Gustavo" in the AI assistant; second-person ("tú") when addressing students.
- **Tone:** Professional, clear, direct. No fluff. Honest and helpful. Expert but approachable.
- **Casing:** Sentence case for body text. Title case used sparingly for section headers. All-caps with wide tracking for eyebrow/overline labels (e.g. `CAPACIDADES`, `PACK ACTIVO`).
- **Emoji:** Not used in UI. Absent from all components and copy.
- **Numbers:** Concrete and credible — "15+ años", "4700+ clases", "4.9 valoración". No vague claims.
- **Pricing:** Always explicit — "€75", "€16/hora". Savings are highlighted as pills.

### Copy Examples
- Hero headline: *"Supera temas difíciles con guía experta y directa"*
- Subhead: *"Acompañamiento personalizado para desbloquear tu potencial de éxito."*
- CTA primary: *"Reservar sesión ahora"*
- CTA secondary: *"Ver disponibilidad"*
- Badge: *"Recomendado"*, *"Pack activo"*
- Section overline: *"Capacidades"* (small uppercase emerald label above h2)
- Footer prompt: *"¿No estás seguro de si puedo ayudarte?"* → *"Pregunta al asistente IA"*

### Writing Rules
- Short sentences. No padding.
- Error messages routed through `friendlyError()` — always kind, never technical jargon to the user.
- Stats backed by verified platforms (Classgap). Never invented numbers.
- Bilingual capability: can respond in Spanish or English depending on the student.

---

## VISUAL FOUNDATIONS

### Color System — Emerald Nocturne
Dark-only UI. No light mode.

**Surfaces (darkest → brightest):**
| Token | Hex | Usage |
|---|---|---|
| `--bg` / `--surface` | `#131315` | Page background (Layer 0) |
| `--surface-lowest` | `#0e0e10` | Deepest elements (rare) |
| `--surface-low` | `#1c1b1d` | Section backgrounds (Layer 1) |
| `--surface-container` | `#201f22` | Cards, inputs (Layer 2) |
| `--surface-high` | `#2a2a2c` | Elevated cards, dropdowns |
| `--surface-highest` | `#353437` | Floating/popovers (Layer 3) |
| `--surface-bright` | `#39393b` | Highest elevation (hover states) |

**Primary (Emerald):**
| Token | Value | Usage |
|---|---|---|
| `--green` | `#4edea3` | Primary action, highlight, icon tint |
| `--green-container` | `#10b981` | Brand anchor, gradient end, hover |
| `--green-dim` | `rgba(78,222,163,0.12)` | Muted green backgrounds |
| `--green-mid` | `rgba(78,222,163,0.25)` | Medium-emphasis green fill |

**Text:**
| Token | Hex | Usage |
|---|---|---|
| `--text` | `#e5e1e4` | Primary text |
| `--text-muted` | `#bbcabf` | Secondary/body text |
| `--text-dim` | `#86948a` | Tertiary/placeholder/timestamps |

**Status:**
- Error: `#ffb4ab` / bg `rgba(255,180,171,0.12)`
- Warning: `#fbbf24` / bg `rgba(251,191,36,0.12)`
- Success: shared with primary (`--green`)

**Borders:**
- Default: `rgba(255,255,255,0.05)` (extremely subtle)
- Variant: `#3c4a42` (green-tinted dark border)
- Interactive: `rgba(78,222,163,0.25)` → `rgba(78,222,163,0.55)` on hover

### Typography
- **Headline font:** Manrope — weights 600, 700, 800. Letter-spacing `-0.02em` on large display text.
- **Body font:** Inter — weights 300, 400, 500, 600. Line-height `1.65`.
- Display sizes: `clamp(2.4rem, 6vw, 4.25rem)` for h1, `clamp(1.75rem, 4vw, 2.75rem)` for h2.
- Overline / eyebrow: `11px`, uppercase, `letter-spacing: 0.1em`, `color: #4edea3`, `font-weight: 600`.
- Stats: `1.75rem`, `font-weight: 800`, Manrope, color `#4edea3`.
- Body: `1rem`, Inter, `line-height: 1.65`.
- Small/meta: `0.75rem`–`0.875rem`, `color: #86948a`.

### Backgrounds & Textures
- **Hero orb:** Radial gradient emerald glow at top of page: `radial-gradient(circle at 50% -20%, rgba(78,222,163,0.15) 0%, rgba(19,19,21,0) 60%)` — fixed, full-width.
- **Grid texture:** Ultra-subtle 60×60px grid overlay: `rgba(255,255,255,0.012)` lines — fixed, full-page. Creates a technical/developer feel.
- No imagery used as full-bleed backgrounds. Cards use flat dark surfaces.
- No gradients on card backgrounds (only on CTAs and text highlights).

### Animations
- `fadeUp`: `translateY(20px) → 0`, `opacity 0 → 1`, duration `0.6s`, `ease`. Used on page sections (staggered `animation-delay`).
- `fadeIn`: `opacity 0 → 1`, `0.4s ease`. Used on modals/panels.
- `skeletonPulse`: Opacity `1 → 0.45 → 1`, `1.4s` infinite — loading skeletons.
- Easing: always `ease` or `ease-in-out`. No bouncy/spring animations.
- Transitions: `0.15s`–`0.2s` for hover states. `0.22s` for panel open/close.
- Chat FAB open/close: scale + rotation (icon swap). Panel: `translateY(16px) scale(0.97)` → `translate(0) scale(1)`.

### Hover & Press States
- **Cards:** `border-color` lifts to `rgba(78,222,163,0.3)`. Background steps up one surface level.
- **Featured cards:** Scale `1.03` → `1.05` on hover.
- **Buttons (primary):** `brightness(1.08)` filter. Scale `1.02` on hero CTA.
- **Buttons (secondary/ghost):** Background fills with surface-bright.
- **Nav links:** Opacity/color shift to `#e5e1e4`.
- **Press state:** `scale(0.95)` on icon buttons (chat send).
- **Chat FAB:** `scale(1.1)` on hover.

### Shadows / Elevation
- `elevation-sm`: `0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)`
- `elevation-md`: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)`
- `elevation-lg`: `0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)`
- `glow-primary`: `0 0 30px rgba(78,222,163,0.4)` — used on avatar, FAB
- `glow-primary-lg`: `0 20px 60px -15px rgba(78,222,163,0.5)`
- Dropdowns: `0 20px 40px rgba(0,0,0,0.4)`, `0 8px 32px rgba(0,0,0,0.5)` for modals

### Border Radius
- `2px` (DEFAULT) — sharp, for data elements (badges inline)
- `4px` (sm)
- `6px` (md) — buttons
- `8px` — cards (small), tooltips, skill items
- `10px` (lg) — buttons (hero CTA), session cards
- `12px` (xl) — cards (main)
- `14px`–`16px` — spec cards, pack cards
- `18px` — chat panel
- `9999px` (full/pill) — badges, suggestion chips, credits pill

### Cards
- Background: `#1c1b1d` (default) or `#201f22` (elevated)
- Border: `rgba(255,255,255,0.06)` default → `rgba(78,222,163,0.25–0.3)` hover/featured
- Border-radius: `12px`–`16px`
- No outer drop-shadow by default; shadow only on floating/elevated cards
- Featured variant: `rgba(78,222,163,0.07)` background, emerald border, slight scale-up

### Layout
- Max content width: `1280px`, centered
- Page padding: `0 16px` mobile → `0 32px` tablet+
- Navbar: fixed, `height ~64px`, frosted glass (`backdrop-filter: blur(20px)`)
- Chat FAB: fixed `bottom: 32px, right: 32px`
- Sections: `padding-bottom: 64px`
- Hero: `min-height: 85vh`, centered

### Transparency & Blur
- Navbar: `rgba(19,19,21,0.85)` + `backdrop-filter: blur(20px)` — consistent frosted glass
- Chat panel: similar frosted treatment on mobile
- Zoom modal backdrop: `rgba(0,0,0,0.85)` + `blur(8px)`
- Dropdowns: solid dark surface (no blur)

### Imagery
- One avatar photo (`/avatar.png`) — rectangular, rounded corners, green glow ring
- No stock photos; no illustrations
- Color vibe: cool-neutral (desaturated photo works best against the dark palette)
- No grain/film texture effects

### Scrollbar
Custom: `width: 6px`, thumb `#3c4a42` → `#4edea3` on hover, track transparent.

### Selection
Background `rgba(78,222,163,0.3)`, text `#4edea3`.

### Focus
`outline: 2px solid #4edea3`, `outline-offset: 2px`.

---

## ICONOGRAPHY

Icons come exclusively from **Material Symbols Outlined** (Google CDN, variable font).

```html
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" />
```

Usage:
```html
<span class="material-symbols-outlined">calendar_month</span>
```

Icons used in the product:
- `expand_more` — dropdown chevron
- `menu` / `close` — hamburger toggle
- `dashboard` — personal area nav
- `admin_panel_settings` — admin nav
- `logout` — sign out
- `calendar_month` — booking / pack scheduling
- `code` — programming specialization
- `dns` — backend development
- `calculate` — math
- `psychology` — AI specialization
- `analytics` — data analysis
- `school` — DAM/DAW courses
- Chat icon: custom inline SVG in `ChatAvatarIcon.tsx`
- Arrow right: custom inline SVG (14×14, stroke `#4edea3`, weight 2.5)

Font variation settings: `"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24`

**No emoji used.** No PNG icon sets. No SVG sprite sheets.

Assets copied to `assets/`:
- `assets/avatar.png` — profile photo
- `assets/favicon.svg` — favicon (emerald-tinted monogram mark)

---

## File Index

```
README.md                          ← This file
SKILL.md                           ← Agent skill definition
colors_and_type.css                ← All CSS variables (colors + typography)
assets/
  avatar.png                       ← Profile photo
  favicon.svg                      ← Brand favicon/logo mark
preview/
  colors-surfaces.html             ← Surface color swatches
  colors-primary.html              ← Primary emerald palette
  colors-status.html               ← Status colors
  colors-text-border.html          ← Text & border tokens
  type-scale.html                  ← Typography scale specimens
  type-fonts.html                  ← Font family specimens
  spacing-radius.html              ← Border radius tokens
  spacing-shadows.html             ← Shadow/elevation system
  components-buttons.html          ← Button variants
  components-badges-alerts.html    ← Badges & alerts
  components-cards.html            ← Card variants
  components-session-pack.html     ← SessionCard & PackCard
  brand-avatar.html                ← Avatar + logo usage
ui_kits/tutoring-platform/
  README.md                        ← UI kit notes
  index.html                       ← Interactive landing page prototype
  Navbar.jsx                       ← Navigation bar component
  HeroSection.jsx                  ← Hero section
  SessionCard.jsx                  ← Session booking card
  PackCard.jsx                     ← Pack purchase card
  ChatWidget.jsx                   ← AI chat widget
```
