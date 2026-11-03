import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SIGNAL BOX // LEVERFRAME — 1856 Mechanical Interlocking & Kiro PBT Exorcist',
  description:
    'Victorian brass mechanical railway interlocking frame, step-by-step fast-check property-based counterexample shrinking, and Kiro Crew MCP coordination.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#0c0b09',
          color: '#ede3ce',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {children}
      </body>
    </html>
  );
}
