import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel/square';
import { GeistSans } from 'geist/font/sans';
import { Chakra_Petch, Doto, Fredoka, Instrument_Serif } from 'next/font/google';
import geo from '../src/tv-geometry.json';
import Shell from './shell';
import '../styles/tv.css';
import '../styles/shell.css';

const fredoka = Fredoka({ weight: '700', subsets: ['latin'], variable: '--font-fredoka', display: 'swap' });
const serif = Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const doto = Doto({ weight: '900', subsets: ['latin'], variable: '--font-doto', display: 'swap' });
/* the menus of the ABOUT channel */
const chakra = Chakra_Petch({
  weight: ['500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-chakra',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Garpez Co. — Creative studio',
  description: 'Garpez is a branding studio.',
  icons: { icon: '/system/favicon.svg' },
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
      className={`${GeistPixelSquare.variable} ${GeistSans.variable} ${GeistMono.variable} ${fredoka.variable} ${doto.variable} ${chakra.variable} ${serif.variable}`}
      style={tvStyle}
    >
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(location.pathname==='/tv'||location.pathname==='/tv/')document.body.classList.add('tv-mode')",
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
