import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';
import { getSiteUrl } from '@/lib/site-url';

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
          '--font-body': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          '--font-header': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        } as React.CSSProperties
      }
    >
      <body className={cn('antialiased')}>
        {/*
          Use "never" so UI polish (sidebar, pages, panels) always animates in the product.
          Switch to reducedMotion="user" if you want to honor OS "Reduce motion" (Framer
          will then snap for those users).
        */}
        <MotionConfig reducedMotion="never">
          {children}
        </MotionConfig>
      </body>
    </html>
  );
}
