import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';
import { getSiteUrl } from '@/lib/site-url';
import { AuthProvider } from '@/lib/auth-context';

const defaultTitle = 'Inceptive — Autonomous AI for Enterprise Teams';
const defaultDescription =
  'Inceptive automates email, research, reporting, and enterprise workflows using autonomous AI agents. Built for growth companies.';

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: defaultTitle, template: '%s · Inceptive' },
  description: defaultDescription,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    siteName: 'Inceptive',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Inceptive' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          '--font-body': "'DM Sans', Inter, Arial, ui-sans-serif, system-ui",
          '--font-header': "'Libre Baskerville', Georgia, ui-serif, serif",
          '--font-mono': "ui-monospace, 'Courier New', monospace",
        } as React.CSSProperties
      }
    >
      <head>
        {/* Libre Baskerville — display serif for headings */}
        {/* DM Sans — geometric sans for body and UI */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('antialiased')}>
        {/*
          Use "never" so UI polish (sidebar, pages, panels) always animates in the product.
          Switch to reducedMotion="user" if you want to honor OS "Reduce motion" (Framer
          will then snap for those users).
        */}
        <MotionConfig reducedMotion="never">
          <AuthProvider>{children}</AuthProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
