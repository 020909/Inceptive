import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['500', '600'],
  display: 'swap',
});

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
          '--font-body': "var(--font-inter), 'Inter', system-ui, sans-serif",
          '--font-header': "var(--font-cormorant), 'Cormorant Garamond', 'Times New Roman', serif",
        } as React.CSSProperties
      }
    >
      <body className={cn(inter.variable, cormorant.variable, inter.className, 'antialiased')}>
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
