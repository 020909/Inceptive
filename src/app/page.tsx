import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site-url";

const title = "Inceptive — Enterprise AI for fast-moving teams";
const description =
  "B2B workspace to delegate research, execution, and integrations to AI with the guardrails enterprises need. Open the app to explore the dashboard, skills, agents, and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Inceptive",
    type: "website",
    locale: "en_US",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Inceptive logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

/* Theme hex mirrors globals.css — inlined so third-party capture tools (e.g. Synthesia) that
 * do not load our stylesheets still show text and backgrounds. */
const C = {
  bg: "#f5f4ed",
  text: "#141413",
  textSecondary: "#4d4c48",
  textMuted: "#87867f",
  border: "#e8e6dc",
  white: "#ffffff",
  accent: "#ff4f00",
} as const;

/**
 * Server-rendered landing with inline styles only (no reliance on CSS variables / Tailwind
 * for critical visibility). Use this URL in Synthesia, link previews, etc.
 */
export default function HomePage() {
  const site = getSiteUrl().origin;
  const logoUrl = `${site}/logo.png`;

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: "48px 24px 64px",
        backgroundColor: C.bg,
        color: C.text,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Visible even if nothing else renders */}
      <div style={{ maxWidth: "40rem", margin: "0 auto", textAlign: "center" }}>
        <img
          src={logoUrl}
          alt="Inceptive logo"
          width={64}
          height={64}
          style={{
            display: "block",
            margin: "0 auto 24px",
            borderRadius: "16px",
            border: `1px solid ${C.border}`,
            backgroundColor: C.white,
            objectFit: "cover",
          }}
        />

        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
            fontWeight: 600,
            lineHeight: 1.2,
            color: C.text,
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          Inceptive
        </h1>

        <p
          style={{
            margin: "0 0 32px",
            fontSize: "1.125rem",
            lineHeight: 1.6,
            color: C.textSecondary,
          }}
        >
          Enterprise AI workspace for research, execution, and integrations — with governance your team can trust.
        </p>

        <p
          style={{
            margin: "0 0 40px",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: C.textMuted,
            maxWidth: "36rem",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          This page is built to work without JavaScript or external stylesheets, so automated video and preview tools can
          read it. Use <strong style={{ color: C.text }}>Open workspace</strong> for the full app (sign in may be
          required for some actions).
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              minWidth: "200px",
              padding: "12px 32px",
              borderRadius: "16px",
              backgroundColor: C.accent,
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open workspace
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "44px",
              padding: "12px 24px",
              borderRadius: "16px",
              border: `1px solid ${C.border}`,
              backgroundColor: C.white,
              color: C.text,
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>

        <p
          style={{
            margin: "56px 0 0",
            fontSize: "0.6875rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: C.textMuted,
          }}
        >
          {site.replace(/^https?:\/\//, "")}
        </p>
      </div>
    </div>
  );
}
