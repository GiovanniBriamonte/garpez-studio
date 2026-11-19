import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { Doto, Fredoka, VT323 } from 'next/font/google';
import geo from '../src/tv-geometry.json';
import '../styles/tv.css';

const vt = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt', display: 'swap' });
const fredoka = Fredoka({ weight: '700', subsets: ['latin'], variable: '--font-fredoka', display: 'swap' });
const doto = Doto({ weight: '900', subsets: ['latin'], variable: '--font-doto', display: 'swap' });

export const metadata: Metadata = {
  title: 'garpez.tv',
  description: 'Garpez is a branding studio.',
};

const tvStyle = {
  '--tv-top': geo.top,
  '--tv-bottom': geo.bottom,
  '--tv-column': geo.column,
  '--sx': `${geo.screen.x}%`,
  '--sy': `${geo.screen.y}%`,
  '--sw': `${geo.screen.w}%`,
  '--sh': `${geo.screen.h}%`,
  '--bw': `${geo.button.w}%`,
  '--bh': `${geo.button.h}%`,
  '--shade-w': `${geo.shade.w}%`,
  '--shade-h': `${geo.shade.h}%`,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${vt.variable} ${fredoka.variable} ${doto.variable}`}
      style={tvStyle}
    >
      <body>{children}</body>
    </html>
  );
}
