import type { Metadata, Viewport } from 'next';
import { Archivo, Fraunces, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

// Archivo is loaded with its width axis so CSS can pin it at wdth 62 — the "Archivo Condensed" of the film's look.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Signal Box // LeverFrame — 1856 mechanical interlocking for parallel AI agents',
  description:
    'A Victorian brass lever frame and tappet locking bed that refuse conflicting moves, an EARS rule table from the Kiro spec, and a fast-check PBT exorcist that shrinks a collision to a three-step replay.',
};

export const viewport: Viewport = {
  themeColor: '#0B0F0D',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
