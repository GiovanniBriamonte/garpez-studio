'use client';

import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { playChannelWipe } from '../src/channel-wipe';

const ChannelNav = createContext<(href: string) => void>(() => {});

export function useChannelNav() {
  return useContext(ChannelNav);
}

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wipeRef = useRef<ReturnType<typeof playChannelWipe> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const seenPath = useRef<string | null>(null);

  const go = (href: string) => {
    if (href === pathname || wipeRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      router.push(href);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      router.push(href);
      return;
    }
    pendingRef.current = href;
    document.body.classList.add('is-channeling');
    const wipe = playChannelWipe(canvas, {
      onCovered: () => router.push(href),
    });
    wipeRef.current = wipe;
    wipe.finally(() => {
      wipeRef.current = null;
      pendingRef.current = null;
      canvas.classList.remove('is-on');
      document.body.classList.remove('is-channeling');
    });
  };

  useLayoutEffect(() => {
    if (seenPath.current === null) {
      seenPath.current = pathname;
      return;
    }
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    if (pendingRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (reduce || !canvas || wipeRef.current) return;
    document.body.classList.add('is-channeling');
    const stop = window.setTimeout(() => document.body.classList.remove('is-channeling'), 420);
    return () => window.clearTimeout(stop);
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
      <canvas ref={canvasRef} className="channel-wipe" aria-hidden="true" />
    </ChannelNav.Provider>
  );
}
