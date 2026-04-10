import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';

export const metadata: Metadata = {
  title: 'Inceptive AI — Your 24/7 AI Employee',
  description: 'The autonomous AI platform that works while you sleep. Research, email, social media, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          '--font-body': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          '--font-header': "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
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
