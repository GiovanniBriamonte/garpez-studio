'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createGlitchOverlay } from '../src/transition/glitch-overlay';
import { createPixelWave } from '../src/transition/pixel-wave';
import { freezePage } from '../src/transition/freeze';
import { reveal, setArrival } from '../src/transition/store';

type NavOptions = { from?: 'dive' };
const ChannelNav = createContext<(href: string, options?: NavOptions) => void>(() => {});

export function useChannelNav() {
  return useContext(ChannelNav);
}

/* plain links (logo, privacy, back from /tv): 'wave' = pixel wave, 'glitch' = static tear */
const PLAIN_NAV: 'wave' | 'glitch' = 'wave';
/* glitch timings */
const COVER_MS = 170;
const RELEASE_MS = 420;
/* pixel wave: one pass across the screen */
const WAVE_MS = 1000;
/* after the dive: longer tear so the /tv zoom-out can be seen through it */
const DIVE_RELEASE_MS = 620;
/* never stay covered longer than this if the route is slow */
const SAFETY_MS = 2000;

type Pending = { href: string; kind: 'dive' | 'wave' | 'glitch'; safety: number };

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<ReturnType<typeof createGlitchOverlay> | null>(null);
  const waveRef = useRef<ReturnType<typeof createPixelWave> | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const waveCanvas = waveCanvasRef.current;
    if (!canvas || !waveCanvas) return;
    const overlay = createGlitchOverlay(canvas);
    const wave = createPixelWave(waveCanvas);
    overlayRef.current = overlay;
    waveRef.current = wave;
    return () => {
      overlay.destroy();
      wave.destroy();
      overlayRef.current = null;
      waveRef.current = null;
    };
  }, []);

  const open = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    window.clearTimeout(pending.safety);
    /* the wave clears its own pending state when the pass ends */
    if (pending.kind === 'wave') return;
    pendingRef.current = null;
    const { kind } = pending;
    /* let the new page paint once under the cover, then open it */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ms = kind === 'dive' ? DIVE_RELEASE_MS : RELEASE_MS;
        document.body.classList.remove('is-diving');
        reveal(ms);
        overlay.release(ms);
      }),
    );
  };

  const go = (href: string, options: NavOptions = {}) => {
    if (href === pathname || pendingRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay = overlayRef.current;
    const wave = waveRef.current;
    if (reduce || !overlay || !wave) {
      router.push(href);
      return;
    }
    const kind = options.from === 'dive' ? 'dive' : PLAIN_NAV;
    const safety = window.setTimeout(open, SAFETY_MS);
    pendingRef.current = { href, kind, safety };
    if (kind === 'dive') {
      setArrival('dive');
      overlay.hold();
      router.push(href);
    } else if (kind === 'wave') {
      /* freeze the old page, load the new one underneath, let the band cut through.
         Going home sweeps back the other way. */
      let ghost: ReturnType<typeof freezePage> = null;
      try {
        ghost = freezePage();
      } catch {
        ghost = null;
      }
      router.push(href);
      wave.sweep(href === '/' ? -1 : 1, WAVE_MS, ghost).then(() => {
        const p = pendingRef.current;
        if (p && p.kind === 'wave') {
          window.clearTimeout(p.safety);
          pendingRef.current = null;
        }
      });
    } else {
      overlay.cover(COVER_MS).then(() => router.push(href));
    }
  };

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (pending && pathname === pending.href) open();
  }, [pathname]);

  const follow = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    go(href);
  };

  return (
    <ChannelNav.Provider value={go}>
      <header className="site-header">
        <a className="site-logo" href="/" onClick={(event) => follow(event, '/')}>
          <img src="/system/logo.svg" alt="garpez" />
        </a>
        <a className="site-talk" href="mailto:ciao@garpez.studio">
          Talk
        </a>
      </header>
      <div className="site-frame">{children}</div>
      <footer className="site-footer">
        <span className="site-copy">© 2026 GARPEZ</span>
        <nav className="site-social" aria-label="Social">
          <a href="https://google.com" target="_blank" rel="noopener">
            Insta
          </a>
          <a href="https://www.linkedin.com/company/garpezstudio/" target="_blank" rel="noopener">
            LinkedIn
          </a>
        </nav>
        <a className="site-privacy" href="/privacy" onClick={(event) => follow(event, '/privacy')}>
          Privacy
        </a>
      </footer>
      <canvas ref={waveCanvasRef} className="pixel-wave" aria-hidden="true" />
      <canvas ref={canvasRef} className="channel-wipe" aria-hidden="true" />
    </ChannelNav.Provider>
  );
}
