import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { ImpersonationBanner } from '@/components/associate/ImpersonationBanner';

// Self-hosted at build time (no runtime Google request) — keeps the default
// dev path free of external dependencies. Exposed as the --font-inter var that
// globals.css consumes.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Trane Supply — HVAC Parts, Equipment & Supplies',
  description: 'Order HVAC equipment, parts, and supplies from Trane Supply.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          {/* Reads search params, so it needs its own boundary to avoid opting the
              whole tree into client-side rendering. */}
          <Suspense fallback={null}>
            <AuthErrorBanner />
          </Suspense>
          {/* Above everything, on every page: an associate must never lose track of
              whose account they are acting in. */}
          <ImpersonationBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
