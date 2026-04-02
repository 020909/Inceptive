import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
          '--font-header': "'Times New Roman', serif",
        } as React.CSSProperties
      }
    >
      <body className={cn(inter.variable, inter.className, 'antialiased')}>
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      </body>
    </html>
  );
}
