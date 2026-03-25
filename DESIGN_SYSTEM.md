# Inceptive AI - Premium Design System

## Inspired by: Manus AI, Perplexity Computer, Claude Cowork

---

## 🎨 Color Palette (Dark Mode - Primary)

### Backgrounds
```
--background: #0a0a0a          // Pure app background
--background-deep: #050505      // Deep background for contrast
--background-elevated: #111111  // Cards, panels, surfaces
--background-overlay: #1a1a1a   // Hover states, overlays
--background-floating: #222222  // Floating elements, modals
```

### Foregrounds (Text)
```
--foreground: #ffffff           // Primary text
--foreground-secondary: #a1a1aa // Secondary text (60% opacity feel)
--foreground-tertiary: #71717a  // Tertiary text (muted)
--foreground-muted: #52525b     // Disabled, placeholders
```

### Accents & Interactive
```
--accent: #6366f1              // Primary accent (Indigo - Manus style)
--accent-hover: #818cf8        // Accent hover state
--accent-subtle: rgba(99, 102, 241, 0.08)  // Subtle accent backgrounds
--accent-glow: rgba(99, 102, 241, 0.15)    // Glow effects

--accent-blue: #3b82f6         // Secondary accent (actions)
--accent-purple: #8b5cf6       // Tertiary accent (highlights)
--accent-green: #10b981        // Success states
--accent-orange: #f59e0b       // Warning states
--accent-red: #ef4444          // Error states
```

### Borders
```
--border: rgba(255, 255, 255, 0.08)      // Primary borders
--border-subtle: rgba(255, 255, 255, 0.05) // Subtle dividers
--border-strong: rgba(255, 255, 255, 0.15) // Emphasized borders
--border-focus: rgba(99, 102, 241, 0.5)    // Focus states
```

### Special Effects
```
--glow-subtle: 0 0 20px rgba(99, 102, 241, 0.1)
--glow-medium: 0 0 40px rgba(99, 102, 241, 0.15)
--glow-strong: 0 0 60px rgba(99, 102, 241, 0.2)

--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4)
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5)
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6)
```

---

## 📐 Typography

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace
```

### Type Scale (Based on 1.25 ratio)
```
--text-xs: 0.75rem (12px)      // Captions, labels
--text-sm: 0.875rem (14px)     // Body small, buttons
--text-base: 1rem (16px)       // Default body
--text-lg: 1.125rem (18px)     // Lead paragraphs
--text-xl: 1.25rem (20px)      // H3, section titles
--text-2xl: 1.5rem (24px)      // H2
--text-3xl: 1.875rem (30px)    // H1
--text-4xl: 2.25rem (36px)     // Display

--font-light: 300
--font-regular: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700

--leading-tight: 1.25
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-loose: 1.75

--tracking-tighter: -0.02em
--tracking-tight: -0.01em
--tracking-normal: 0
--tracking-wide: 0.02em
--tracking-wider: 0.05em
```

### Heading Styles
```css
h1 {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--foreground);
}

h2 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--foreground);
}

h3 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--foreground);
}
```

---

## 📏 Spacing System (8px Grid)

```
--space-0: 0
--space-1: 0.25rem (4px)
--space-2: 0.5rem (8px)
--space-3: 0.75rem (12px)
--space-4: 1rem (16px)
--space-5: 1.25rem (20px)
--space-6: 1.5rem (24px)
--space-8: 2rem (32px)
--space-10: 2.5rem (40px)
--space-12: 3rem (48px)
--space-16: 4rem (64px)
--space-20: 5rem (80px)
--space-24: 6rem (96px)
```

---

## 🔲 Layout System

### Sidebar (Manus-style)
```css
--sidebar-width: 260px        // Expanded
--sidebar-width-collapsed: 64px
--sidebar-padding: 12px
--sidebar-item-height: 40px
--sidebar-item-padding: 10px 12px
--sidebar-gap: 4px           // Between items
```

### Main Content
```css
--content-max-width: 1280px
--content-padding: 24px
--content-padding-mobile: 16px
```

### Grid System
```css
--grid-columns: 12
--grid-gap: 24px
--grid-gutter: 24px
```

---

## 🎭 Component Styles

### Buttons

#### Primary Button (Manus-style)
```css
.btn-primary {
  height: 40px;
  padding: 0 20px;
  border-radius: 10px;
  background: var(--foreground);  // White background
  color: var(--background);       // Black text
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover {
  transform: scale(1.02);
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
}

.btn-primary:active {
  transform: scale(0.98);
}
```

#### Secondary Button
```css
.btn-secondary {
  height: 40px;
  padding: 0 20px;
  border-radius: 10px;
  background: var(--background-elevated);
  color: var(--foreground);
  border: 1px solid var(--border);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: var(--background-overlay);
  border-color: var(--border-strong);
}
```

#### Ghost Button
```css
.btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.btn-ghost:hover {
  background: var(--background-overlay);
  color: var(--foreground);
}
```

### Cards (Manus-style)
```css
.card {
  background: var(--background-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.card-elevated {
  background: var(--background-floating);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-xl);
}
```

### Input Fields
```css
.input {
  height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--background-elevated);
  border: 1px solid var(--border);
  color: var(--foreground);
  font-size: 0.875rem;
  transition: all 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.input::placeholder {
  color: var(--foreground-muted);
}
```

### Chat Message Bubbles (Perplexity-style)
```css
.message-user {
  background: var(--foreground);
  color: var(--background);
  border-radius: 20px 20px 4px 20px;
  padding: 12px 16px;
  max-width: 80%;
  font-size: 0.875rem;
  line-height: 1.5;
}

.message-assistant {
  background: var(--background-elevated);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: 20px 20px 20px 4px;
  padding: 12px 16px;
  max-width: 85%;
  font-size: 0.875rem;
  line-height: 1.6;
}
```

### Modals & Dialogs
```css
.modal {
  background: var(--background-floating);
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.modal-overlay {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
```

---

## ✨ Animations & Transitions

### Timing Functions
```css
--ease-out: cubic-bezier(0.215, 0.61, 0.355, 1)
--ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)
```

### Transition Durations
```css
--duration-fast: 100ms
--duration-normal: 150ms
--duration-slow: 200ms
--duration-slower: 300ms
--duration-slowest: 500ms
```

### Hover Animations
```css
.hover-lift {
  transition: transform 0.2s var(--ease-spring), 
              box-shadow 0.2s var(--ease-out);
}

.hover-lift:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow: var(--shadow-lg);
}

.hover-scale {
  transition: transform 0.15s var(--ease-smooth);
}

.hover-scale:hover {
  transform: scale(1.02);
}

.hover-glow {
  transition: box-shadow 0.2s var(--ease-out);
}

.hover-glow:hover {
  box-shadow: var(--glow-medium);
}
```

### Page Transitions (Manus-style)
```css
.page-enter {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.page-enter-active {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition: opacity 0.3s var(--ease-out),
              transform 0.3s var(--ease-spring);
}

.page-exit {
  opacity: 1;
  transform: scale(1);
}

.page-exit-active {
  opacity: 0;
  transform: scale(0.98);
  transition: opacity 0.2s var(--ease-out),
              transform 0.2s var(--ease-in);
}
```

### Loading Animations
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--background-elevated) 0%,
    var(--background-overlay) 50%,
    var(--background-elevated) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.pulse-dot {
  animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Message Appearance Animation
```css
@keyframes message-slide {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.message-animate {
  animation: message-slide 0.3s var(--ease-spring) forwards;
}
```

---

## 🔘 Border Radius System

```css
--radius-sm: 6px      // Small elements
--radius-md: 10px     // Buttons, inputs
--radius-lg: 12px     // Cards
--radius-xl: 16px     // Large cards, modals
--radius-2xl: 20px    // Dialogs, large modals
--radius-full: 9999px // Pills, avatars
```

---

## 🎯 Icon System

```css
--icon-xs: 12px
--icon-sm: 14px
--icon-md: 16px
--icon-lg: 18px
--icon-xl: 20px
--icon-2xl: 24px

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-button:hover {
  background: var(--background-overlay);
}
```

---

## 🌟 Glassmorphism Effects

```css
.glass {
  background: rgba(17, 17, 17, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glass-strong {
  background: rgba(17, 17, 17, 0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.glass-subtle {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

---

## 📱 Responsive Breakpoints

```css
--breakpoint-sm: 640px   // Mobile landscape
--breakpoint-md: 768px   // Tablet
--breakpoint-lg: 1024px  // Desktop small
--breakpoint-xl: 1280px  // Desktop
--breakpoint-2xl: 1536px // Desktop large
```

---

## 🎨 Design Principles

1. **Minimalist Elegance** - Every element serves a purpose, no decoration
2. **Subtle Depth** - Layered surfaces with minimal shadows
3. **Smooth Motion** - All animations feel natural and purposeful
4. **High Contrast** - Text is always legible, hierarchy is clear
5. **Consistent Spacing** - 8px grid throughout
6. **Premium Feel** - Refined details, generous whitespace
7. **Focus on Content** - UI recedes, content takes center stage
8. **Micro-interactions** - Every interaction feels responsive

---

## 🔧 Implementation Priority

### Phase 1: Foundation (First)
1. Update `globals.css` with new design tokens
2. Fix typography scale
3. Update button styles
4. Update card styles

### Phase 2: Layout (Second)
1. Refine sidebar design
2. Update page layouts
3. Fix spacing throughout

### Phase 3: Animations (Third)
1. Add page transitions
2. Add hover effects
3. Add loading states
4. Add message animations

### Phase 4: Polish (Last)
1. Add glassmorphism effects
2. Refine borders and shadows
3. Add micro-interactions
4. Test all states
