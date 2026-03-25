import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { MotionConfig } from 'framer-motion';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Inceptive AI - Your 24/7 AI Employee',
  description: 'Autonomous AI Platform for Research, Email, Social Media, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark h-full", inter.variable)}>
      <body className="h-full bg-[#1A1A1A] text-white antialiased font-sans">
        <MotionConfig transition={{ type: "spring", stiffness: 100, damping: 20 }}>
          {children}
        </MotionConfig>
      </body>
    </html>
  );
}
