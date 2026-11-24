'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { mountTv } from '../src/tv-engine';
import geo from '../src/tv-geometry.json';
import type { VideoChannel } from './channels';
import { clearTvOn, onReveal, peekTvOn, takeArrival } from '../src/transition/store';

/* set to false to arrive on /tv without the zoom-out from the screen */
const ARRIVE_ZOOM = true;
const ARRIVE_MS = 1100;

export default function Television({ videos, models }: { videos: VideoChannel[]; models: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.add('tv-mode');
    return () => body.classList.remove('tv-mode');
  }, []);

  /* coming from the landing dive: start inside the screen and pull back */
  useLayoutEffect(() => {
    const arrival = takeArrival();
    const root = rootRef.current;
    if (!ARRIVE_ZOOM || arrival !== 'dive' || !root) return;
    const wrap = root.querySelector<HTMLElement>('.wrap');
    const screen = root.querySelector<HTMLElement>('#screen');
    if (!wrap || !screen) return;
    const w = wrap.getBoundingClientRect();
    const s = screen.getBoundingClientRect();
    if (s.width < 2 || s.height < 2) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = s.left + s.width / 2;
    const cy = s.top + s.height / 2;
    const k = Math.max(vw / s.width, vh / s.height) * 1.18;
    const from = `translate(${vw / 2 - cx}px, ${vh / 2 - cy}px) scale(${k})`;
    wrap.style.transformOrigin = `${cx - w.left}px ${cy - w.top}px`;
    wrap.style.transform = from;
    let anim: Animation | null = null;
    const off = onReveal(() => {
      off();
      anim = wrap.animate(
        [
          { transform: from, filter: 'blur(6px) brightness(1.6)' },
          { transform: from, filter: 'blur(2px) brightness(1.2)', offset: 0.12 },
          { transform: 'none', filter: 'none' },
        ],
        { duration: ARRIVE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
      );
      wrap.style.transform = '';
      anim.finished
        .then(() => {
          anim?.cancel();
          wrap.style.transformOrigin = '';
        })
        .catch(() => {});
    });
    return () => {
      off();
      anim?.cancel();
      wrap.style.transform = '';
      wrap.style.transformOrigin = '';
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const power = peekTvOn();
    const stop = mountTv(root, videos, models, { power });
    /* keep the flag across a strict-mode remount; drop it once this visit has started */
    const clear = window.setTimeout(() => {
      if (power) clearTvOn();
    }, 0);
    return () => {
      window.clearTimeout(clear);
      stop();
    };
  }, [videos, models]);

  return (
    <div ref={rootRef}>
      <div className="wrap">
        <div className="backdrop" />
        <main className="stage" id="tv">
          <img id="base" className="feather" src="/assets/dark.webp" alt="garpez.tv television set" draggable={false} />
          <canvas className="spill" id="spill" width={1600} height={900} />
          <div className="screen" id="screen">
            <div className="tube" id="tube">
              <canvas id="c" width={400} height={geo.canvasHeight} aria-label="TV screen" />
              <canvas id="gl" aria-hidden="true" />
              <div className="infoch" id="info">
                <div className="infoch-copy">
                  <h2>Garpez:</h2>
                  <p>Two Italians in Oslo, making things we wish existed. We turn ideas into brands, websites and digital experiences for startups and people building something new. We think, design, code, animate, experiment, and obsess over the little details. Small studio. Big curiosity.</p>
                </div>
                <div className="infoch-links">
                  <a href="mailto:ciao@garpez.studio">Email</a>
                  <a href="https://google.com" target="_blank" rel="noopener">Insta</a>
                  <a href="https://www.linkedin.com/company/garpezstudio/" target="_blank" rel="noopener">LinkedIn</a>
                </div>
              </div>
              <div className="crt" />
            </div>
          </div>
          {geo.keys.map((key, i) => (
            <img
              key={`pressed-${key.label}`}
              className="pressed"
              src={`/assets/key${i}.webp`}
              alt=""
              draggable={false}
              style={{
                left: `${key.pressed.left}%`,
                top: `${key.pressed.top}%`,
                width: `${key.pressed.width}%`,
                height: `${key.pressed.height}%`,
              }}
            />
          ))}
          {geo.keys.map((key) => (
            <div key={`shade-${key.label}`} className="shade" style={{ left: `${key.at.x}%`, top: `${key.at.y}%` }} />
          ))}
          {geo.keys.map((key) => (
            <button key={`btn-${key.label}`} className="btn" style={{ left: `${key.at.x}%`, top: `${key.at.y}%` }} aria-label={key.label} />
          ))}
        </main>
      </div>
      <div className="remote" aria-label="Remote">
        <button className="r-info" data-for="0">INFO</button>
        <button className="r-ch" data-for="1">CH−</button>
        <button className="r-ch" data-for="2">CH+</button>
        <button className="r-pw" data-for="3">POWER</button>
      </div>
      <div className="copy">© 2026 GARPEZ</div>
    </div>
  );
}
