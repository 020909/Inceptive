/**
 * When Council agents fail partially or deliver thin CSS, merge this so the preview
 * never falls back to raw browser defaults (unstyled serif / blue links).
 */
export const EDITORIAL_BASE_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap");

:root {
  --bg: #0f0f0e;
  --bg-elevated: #161614;
  --paper: #f5f2eb;
  --muted: rgba(245, 242, 235, 0.72);
  --faint: rgba(245, 242, 235, 0.45);
  --line: rgba(245, 242, 235, 0.12);
  --accent: #c4b8a5;
  --accent-2: #8a7f6b;
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  --radius: 14px;
  --max: 1120px;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-display: "Instrument Serif", Georgia, serif;
}

*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  color: var(--paper);
  background:
    radial-gradient(900px 520px at 12% -10%, rgba(196, 184, 165, 0.18), transparent 55%),
    radial-gradient(700px 480px at 88% 8%, rgba(138, 127, 107, 0.16), transparent 50%),
    var(--bg);
}

a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid rgba(196, 184, 165, 0.35);
  transition: color 0.15s ease, border-color 0.15s ease;
}
a:hover {
  color: var(--accent);
  border-bottom-color: rgba(196, 184, 165, 0.65);
}

:focus-visible {
  outline: 2px solid rgba(196, 184, 165, 0.65);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Nav */
header, nav[role="navigation"], .site-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: var(--max);
  margin: 0 auto;
  padding: 1.1rem 1.5rem;
}

.site-nav a,
nav a {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-bottom: none;
  opacity: 0.92;
}
.site-nav a:hover,
nav a:hover { opacity: 1; }

.brand, .logo {
  font-family: var(--font-display);
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}

/* Hero */
main, section {
  max-width: var(--max);
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0 0 0.75rem;
}

h1 { font-size: clamp(2.1rem, 4vw, 3.1rem); }
h2 { font-size: clamp(1.5rem, 2.6vw, 2rem); margin-top: 2.5rem; }
h3 { font-size: 1.15rem; font-family: var(--font-sans); font-weight: 700; }

p.lead, .subtitle, .subhead {
  color: var(--muted);
  font-size: 1.05rem;
  max-width: 52ch;
  margin: 0 0 1.5rem;
}

/* CTA as button */
.btn, .button, [role="button"],
a.cta, .cta, button:not([class]) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid var(--line);
  background: rgba(245, 242, 235, 0.06);
  color: var(--paper);
  cursor: pointer;
  border-bottom: 1px solid var(--line);
  transition: background 0.15s ease, transform 0.15s ease;
}
.btn:hover, .button:hover, a.cta:hover, .cta:hover, button:not([class]):hover {
  background: rgba(245, 242, 235, 0.1);
  transform: translateY(-1px);
}

/* Feature grid / cards */
ul.features, .features, .grid, [class*="feature"] {
  list-style: none;
  padding: 0;
  margin: 2rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

li, article, .card {
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.25rem 1.35rem;
  box-shadow: var(--shadow);
}

/* Kill default list bullets in generic lists inside content */
main ul:not(.features) {
  padding-left: 1.25rem;
  color: var(--muted);
}

footer {
  max-width: var(--max);
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
  font-size: 0.8rem;
  color: var(--faint);
  border-top: 1px solid var(--line);
}
`.trim();

export function mergeCssWithEditorialBase(css: string): string {
  const t = (css || "").trim();
  if (t.length > 1800) return t;
  return `${EDITORIAL_BASE_CSS}\n\n/* Agent / model CSS */\n${t}`;
}
