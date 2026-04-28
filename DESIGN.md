# Inceptive Design System

> Inceptive OS v3.0 — Rounded Command Intelligence

---

## Philosophy

- **Dark-first design** with optional light mode
- **No shadows** — depth expressed through tonal backgrounds
- **Rounded corners throughout** — from 4px to 9999px
- **Three-typeface system** — Sora (display), DM Sans (body), JetBrains Mono (data)

---

## Typography

### Typefaces

| Token | Font | Usage |
|-------|------|-------|
| `--font-display` | Sora | Headlines, display text |
| `--font-header` | Sora | Page titles (alias for display) |
| `--font-body` | DM Sans | Body text, UI elements |
| `--font-mono` | JetBrains Mono | Code, data, monospace |

### Scale

| Level | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| h1 | 48px | 700 | 1.1 | -0.03em |
| h2 | 28px | 600 | 1.2 | -0.025em |
| h3 | 20px | 600 | 1.3 | -0.015em |
| h4-h6 | 15px | 600 | 1.4 | -0.01em |
| Body | 14px | 400 | 1.6 | — |
| Small | 12px | 400 | 1.55 | — |
| Mono | 13px | 400 | 1.4 | 0.01em |
| Label Caps | 10px | 700 | 1 | 0.12em |

---

## Color System — The Void Stack

### Backgrounds (Dark Mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `--void` | #040506 | Deepest background |
| `--surface-deep` | #070A0B | Elevated surfaces |
| `--surface-primary` | #0C0F10 | Cards, panels |
| `--surface-container` | #111416 | Widgets, inputs |
| `--surface-elevated` | #181C1E | Hover states |
| `--surface-bright` | #202527 | Modals, popovers |

### Backgrounds (Light Mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `--void` | #F7F8FA | Page background |
| `--surface-deep` | #FFFFFF | Elevated |
| `--surface-primary` | #FFFFFF | Cards |
| `--surface-container` | #F2F4F7 | Widgets |
| `--surface-elevated` | #FFFFFF | Inputs |
| `--surface-bright` | #E9EDF2 | Popovers |

### Text Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--text-primary` | #F0F2F3 | #0B0D10 | Primary text |
| `--text-secondary` | #8A9AA8 | #475569 | Secondary text |
| `--text-muted` | #3D464D | #8B95A1 | Placeholders, hints |
| `--text-inverse` | #070A0B | #FFFFFF | Text on light/dark buttons |

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--border-faint` | #181C1E (D) / #DDE3EA (L) | Subtle borders |
| `--border-subtle` | #232829 (D) / #CBD5E1 (L) | Input borders |
| `--border-strong` | #2F3437 (D) / #94A3B8 (L) | Focus rings, active states |

### Semantic Signals

| Token | Hex | Usage |
|-------|-----|-------|
| `--signal-positive` | #16A34A | Success, active |
| `--signal-negative` | #DC2626 | Error, destructive |
| `--signal-warning` | #D97706 | Warning, caution |
| `--signal-info` | #0EA5E9 | Info, links |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Table rows, small elements |
| `--radius-sm` | 8px | Buttons, inputs, nav items |
| `--radius-md` | 14px | Cards, widgets |
| `--radius-lg` | 20px | Large cards, modals |
| `--radius-xl` | 28px | XL modals |
| `--radius-full` | 9999px | Pills, avatars, badges |

---

## Spacing

Base unit: **4px**

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-xxl` | 48px |

---

## Components

### Buttons

**Primary Button**
```
background: var(--action-primary) /* white */
color: var(--text-inverse) /* black */
border-radius: var(--radius-sm) /* 8px */
padding: 8px 20px
font: 12px, 700 weight, uppercase, tracking 0.12em
```

**Ghost Button**
```
background: transparent
border: 1px solid var(--border-strong)
color: var(--text-primary)
border-radius: var(--radius-sm)
```

### Inputs

```
background: var(--surface-elevated)
border: 1px solid var(--border-subtle)
border-radius: var(--radius-sm)
height: 36px
padding: 0 12px
font: 13px, var(--font-body)
color: var(--text-primary)
placeholder: var(--text-muted)

/* Focus state */
border-color: var(--text-secondary)
ring: 2px solid var(--ring)
ring-offset: 2px
ring-offset-color: var(--surface-container)
```

### Widget/Card

```
background: var(--surface-container)
border: 1px solid var(--border-subtle)
border-radius: var(--radius-lg) /* 20px */
padding: 24px
```

### Status Pills

```
display: inline-flex
padding: 3px 10px
border-radius: var(--radius-full) /* 9999px */
font: 10px, 700 weight, uppercase, tracking 0.12em

/* Variants */
pill-positive: green text + green bg
pill-negative: red text + red bg
pill-warning: amber text + amber bg
pill-info: blue text + blue bg
```

---

## shadcn/ui Integration

The design system maps to shadcn/ui via CSS variables in `globals.css`:

| shadcn Variable | Maps To |
|-----------------|---------|
| `--background` | `--void` |
| `--foreground` | `--text-primary` |
| `--card` | `--surface-container` |
| `--popover` | `--surface-bright` |
| `--primary` | `--action-primary` |
| `--secondary` | `--surface-elevated` |
| `--muted` | `--surface-primary` |
| `--border` | `--border-subtle` |
| `--input` | `--surface-elevated` |
| `--ring` | `--border-strong` |
| `--destructive` | `--signal-negative` |

### Sidebar Variables

```css
--sidebar-background: hsl(210 15% 5%);   /* Dark */
--sidebar-foreground: hsl(210 20% 95%);
--sidebar-accent: hsl(210 15% 9%);
--sidebar-border: hsl(210 10% 14%);
--sidebar-ring: hsl(210 10% 17%);
```

---

## Usage Guidelines

### Do

- Use CSS variables for all colors
- Use design system border radius tokens
- Apply `text-wrap: balance` to headings
- Use semantic signal colors for status

### Don't

- Use hardcoded hex values
- Use `box-shadow` (design system prohibits shadows)
- Mix different border radius values arbitrarily
- Use `white` or `black` directly — always use tokens

---

## Theme Implementation

Dark mode is default. Light mode via `.light` class on `:root`:

```css
:root.light {
  --void: #F7F8FA;
  --surface-primary: #FFFFFF;
  /* ... etc */
}
```

---

## Migration Notes

### Completed Refactors

- ✅ Typography: Aligned all components to use Sora/DM Sans/JetBrains Mono
- ✅ Colors: Replaced hardcoded hex values with CSS variables
- ✅ Sidebar: Consolidated to shadcn/ui sidebar with proper CSS variables
- ✅ Focus rings: Added accessible focus states to all interactive elements

### Files Modified

- `src/app/layout.tsx` — Font variable alignment
- `src/app/globals.css` — Sidebar CSS variables, semantic colors
- `src/app/login/page.tsx` — Tokenized all hardcoded colors
- `src/app/signup/page.tsx` — Tokenized all hardcoded colors
- `src/components/layout/` — Removed orphaned components
