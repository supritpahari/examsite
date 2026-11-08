# Design — World of Physics

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

Division of the world: **outside the portal is warm and alive; inside the portal
(`app/exam/page.tsx`) is the faithful, serious NTA-style CBT and is excluded from
this system.** Everything else — landing, course funnel, admin, legal, system
screens — follows what is written here.

## Genre

playful

## Macrostructure family

- Marketing pages (landing): **Stat-Led** — giant rounded counter as the hero
  figure, paired with a worded headline (Hallmark gate: a bare number never
  stands alone). The CBT preview rebuilt as a hand-made Tier-A CSS artefact.
- App pages (course funnel, admin back-office): **Workbench** — function-first,
  dense panels, zero ornament. Enrichment is banned on app pages.
- Content pages (privacy-policy, terms-of-service): **Long Document** —
  continuous prose, inline section heads, no decoration.

## Theme

Hum (catalog). Cream paper, multi-accent (pear · sky-cyan · coral), rounded sans.

- `--color-paper`      oklch(97% 0.012 95)
- `--color-paper-2`    oklch(94% 0.016 95)
- `--color-paper-3`    oklch(91% 0.020 95)
- `--color-ink`        oklch(20% 0.012 250)
- `--color-ink-2`      oklch(38% 0.010 250)
- `--color-muted`      oklch(52% 0.010 250)
- `--color-rule`       oklch(88% 0.012 95)
- `--color-accent`     oklch(86% 0.18 95)    — pear, primary action only
- `--color-accent-deep` oklch(74% 0.19 85)   — pear button edge / pressed
- `--color-accent-2`   oklch(66% 0.18 235)   — sky-cyan, links / secondary
- `--color-accent-2-deep` oklch(44% 0.16 235) — small cyan text
- `--color-accent-3-deep` oklch(42% 0.19 18)  — small coral text
- `--color-mint-deep`   oklch(43% 0.12 150)   — small green text
- `--color-danger`      oklch(47% 0.20 18)    — error text / fills
- `--color-on-accent-2` oklch(20% 0.012 250)  — ink on cyan
- `--color-accent-3`   oklch(68% 0.24 18)    — coral, ONE high-energy moment per page
- `--color-mint`       oklch(80% 0.16 150)   — success states only
- `--color-lavender`   oklch(74% 0.16 305)   — occasional tag chips, max one per page
- `--color-focus`      oklch(66% 0.18 235)
- `--color-panel`      oklch(24% 0.015 250)  — admin sidebar / CBT-adjacent dark panels

Accent law: pear = primary action · cyan = links & hover tints · coral = the
single emphatic moment per viewport · mint = success · lavender = rare tag.
Accents never blend in gradients; each owns its own surface.

## Typography

- Display: **Plus Jakarta Sans**, weight 600, tracking −0.025em (sentence case,
  roman — no italics on heads)
- Body: Plus Jakarta Sans, weight 400 (500 for inline emphasis), ink at ~90%
- Mono: JetBrains Mono, weight 400/500 — uppercase labels, ordinals, tabular
  numerals only
- No serif anywhere. Ever.
- Scale: 1.25 major third anchored at 16px; `--text-display` =
  clamp(2.75rem, 5vw + 1rem, 5.25rem)
- Tabular numerals on every counter, timer, and data column

## Spacing

4-point named scale (`--space-3xs` … `--space-3xl`). Pages use named tokens,
never raw px values. One shell width everywhere: plain sections and
full-bleed bands both align to `--page-max` with `--page-gutter` inside.

## Motion

- `--ease-out` cubic-bezier(0.16,1,0.3,1) · `--ease-in` cubic-bezier(0.7,0,0.84,0)
- `--ease-in-out` cubic-bezier(0.65,0,0.35,1) · `--ease-spring` cubic-bezier(0.34,1.56,0.64,1)
- `--ease-snap` cubic-bezier(0.22,1,0.36,1) — tick-ups, reveals
- Durations: `--dur-micro` 140ms · `--dur-short` 220ms · `--dur-long` 420ms
- Reveal: one orchestrated entrance per page, translateY(12px → 0) + opacity,
  600ms `--ease-snap`, 80ms stagger, capped
- Counters: tick up on view-enter, 1200ms, `--ease-snap`, one scale pulse on
  completion
- Reduced motion: spatial motion collapses to ≤150ms opacity crossfade;
  counters render final value; character stops pulsing; star-burst disabled

## Microinteractions stance

- Silent success — no "Done!" toasts; failure states do get messages
- Hover-lift on cards (`translateY(-4px)`, shadow brightens) · CTA = the Hum
  push button (4px solid edge + cast shadow; hover lifts 2px, `:active` presses
  down 3px). Spring overshoot lives ONLY on the primary CTA
- Hover delay 800ms · focus delay 0ms · focus rings instant, 3px cyan
- Star-burst on primary-action completion, coral, 420ms, fires once
- No carousel autoplay, no cursor followers, no scroll-jacking

## CTA voice

- Primary CTA: pear pill, ink text, push-edge shadow, specific verb
  ("Begin your test", "Get the test code", "Save question")
- Secondary CTA: soft flat-lift (paper-2 face, ink text) or outline (hairline
  ink border, fill sweeps up on hover)
- One push button per primary moment

## Per-page allowances

- Marketing pages MAY use enrichment — Tier A CSS art only (the rebuilt CBT
  preview). No photography (none exists), no generated imagery.
- App pages MUST NOT use enrichment. Function carries the page.
- Content pages: typography only.
- Public pages: Ft8 marquee footer. Admin + legal: Ft2-style single rule line.

## What pages MUST share

- The wordmark **World of Physics** (Plus Jakarta Sans 700, tight tracking)
- The accent colours and their law (pear action / cyan link / coral pop)
- Display + body + mono fonts
- The CTA voice (push button shape, pill radius, padding rhythm)
- One alignment shell (`--page-max` + `--page-gutter` on every section,
  bands included — edges must match to the pixel)
- Section heading rhythm (mono label above, heading directly beneath,
  same column — never tag-left / heading-right)

## What pages MAY differ on

- Macrostructure within the page-type family
- Hero archetype and enrichment (marketing only)
- Card physics: marketing may keep the spring lift; admin uses flat hairline
  cards with a 1px rule, no lift

## Exports

### tokens.css

```css
:root {
  --color-paper:      oklch(97% 0.012 95);
  --color-paper-2:    oklch(94% 0.016 95);
  --color-paper-3:    oklch(91% 0.020 95);
  --color-ink:        oklch(20% 0.012 250);
  --color-ink-2:      oklch(38% 0.010 250);
  --color-muted:      oklch(52% 0.010 250);
  --color-rule:       oklch(88% 0.012 95);
  --color-accent:     oklch(86% 0.18 95);
  --color-accent-deep: oklch(74% 0.19 85);
  --color-accent-2:   oklch(66% 0.18 235);
  --color-accent-2-deep: oklch(44% 0.16 235);
  --color-accent-3:   oklch(68% 0.24 18);
  --color-accent-3-deep: oklch(42% 0.19 18);
  --color-mint:       oklch(80% 0.16 150);
  --color-mint-deep:  oklch(43% 0.12 150);
  --color-danger:     oklch(47% 0.20 18);
  --color-lavender:   oklch(74% 0.16 305);
  --color-focus:      oklch(66% 0.18 235);

  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body:    "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --space-3xs: 0.125rem;  --space-2xs: 0.25rem;  --space-xs: 0.5rem;
  --space-sm:  0.75rem;   --space-md:  1rem;     --space-lg: 1.5rem;
  --space-xl:  2.5rem;    --space-2xl: 4rem;     --space-3xl: 6rem;

  --text-xs: 0.64rem;  --text-sm: 0.8rem;   --text-base: 1rem;
  --text-md: 1.25rem;  --text-lg: 1.5625rem; --text-xl: 1.9531rem;
  --text-2xl: 2.4414rem; --text-3xl: 3.0518rem; --text-4xl: 3.8147rem;
  --text-display: clamp(2.75rem, 5vw + 1rem, 5.25rem);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:  cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-snap: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-micro: 140ms; --dur-short: 220ms; --dur-long: 420ms;
  --radius-card: 20px; --radius-pill: 999px; --radius-input: 12px; --radius-sm: 8px;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper:   oklch(97% 0.012 95);
  --color-paper-2: oklch(94% 0.016 95);
  --color-ink:     oklch(20% 0.012 250);
  --color-accent:  oklch(86% 0.18 95);
  --color-accent-2: oklch(66% 0.18 235);
  --color-accent-3: oklch(68% 0.24 18);
  --font-display:  "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body:     "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono:     "JetBrains Mono", ui-monospace, monospace;
  --spacing-md:    1.5rem;
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper":  { "$value": "oklch(97% 0.012 95)", "$type": "color" },
    "paper-2": { "$value": "oklch(94% 0.016 95)", "$type": "color" },
    "ink":    { "$value": "oklch(20% 0.012 250)", "$type": "color" },
    "accent": { "$value": "oklch(86% 0.18 95)",  "$type": "color" },
    "accent-2": { "$value": "oklch(66% 0.18 235)", "$type": "color" },
    "accent-3": { "$value": "oklch(68% 0.24 18)",  "$type": "color" }
  },
  "font": {
    "display": { "$value": "Plus Jakarta Sans", "$type": "fontFamily" },
    "body":    { "$value": "Plus Jakarta Sans", "$type": "fontFamily" },
    "mono":    { "$value": "JetBrains Mono",    "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background:         97% 0.012 95;
  --foreground:         20% 0.012 250;
  --primary:            86% 0.18 95;
  --primary-foreground: 20% 0.012 250;
  --muted:              88% 0.012 95;
  --muted-foreground:   52% 0.010 250;
  --border:             88% 0.012 95;
  --input:              88% 0.012 95;
  --ring:               66% 0.18 235;
  --radius:             0.75rem;
}
```

## Provenance

Locked 2026-11-08 by `hallmark redesign`. Source: pre-existing inline "v2"
editorial system (paper `#f4f0e8` · Instrument Serif · red accent) replaced
wholesale by the user's direction: *"Fresh redesign, different look — playful."*
`app/exam/page.tsx` keeps the legacy editorial skin by explicit instruction.
