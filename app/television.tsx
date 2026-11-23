'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { mountTv } from '../src/tv-engine';
import geo from '../src/tv-geometry.json';
import type { VideoChannel } from './channels';

export default function Television({ videos, models }: { videos: VideoChannel[]; models: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.add('tv-mode');
    return () => body.classList.remove('tv-mode');
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return mountTv(root, videos, models);
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
                <p>Two Italians in Oslo, making things we wish existed. We turn ideas into brands, websites and digital experiences for startups and people building something new. We think, design, code, animate, experiment, and obsess over the little details. Small studio. Big curiosity.</p>
                <div>
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
