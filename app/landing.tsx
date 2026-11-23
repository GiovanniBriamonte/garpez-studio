'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mountLandingTv } from '../src/landing/tv-stage';
import { useChannelNav } from './shell';

const STATEMENT =
  'Two Italians in Oslo, making things we wish existed. We turn ideas into brands, websites and digital experiences for startups and people building something new. We think, design, code, animate, experiment, and obsess over the little details. Small studio. Big curiosity.';

function chromeHeight(name: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function targetBox(first: DOMRect) {
  const top = chromeHeight('--header-h');
  const bottom = chromeHeight('--footer-h');
  const areaH = Math.max(1, window.innerHeight - top - bottom);
  const aspect = first.width / Math.max(first.height, 1);
  const maxW = window.innerWidth * 0.86;
  const maxH = areaH * 0.9;
  let width = maxH * aspect;
  let height = maxH;
  if (width > maxW) {
    width = maxW;
    height = width / aspect;
  }
  return {
    left: (window.innerWidth - width) / 2,
    top: top + (areaH - height) / 2,
    width,
    height,
  };
}

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const go = useChannelNav();
  const goRef = useRef(go);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.classList.remove('is-zoomed');
      stage.style.left = '';
      stage.style.top = '';
      stage.style.width = '';
      stage.style.height = '';
      stage.style.transform = '';
      stage.style.transformOrigin = '';
    }
    busy.current = false;
    setLeaving(false);
  }, [router]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    router.prefetch('/tv');

    let frame = 0;
    let handed = false;
    const zoom = () => {
      if (busy.current) return;
      busy.current = true;
      if (reduce) {
        goRef.current('/tv');
        return;
      }
      setLeaving(true);
      const first = stage.getBoundingClientRect();
      const target = targetBox(first);
      stage.classList.add('is-zoomed');
      stage.style.left = `${target.left}px`;
      stage.style.top = `${target.top}px`;
      stage.style.width = `${target.width}px`;
      stage.style.height = `${target.height}px`;
      const last = stage.getBoundingClientRect();
      const s = last.width > 0 ? first.width / last.width : 1;
      const dx = first.left + first.width / 2 - (last.left + last.width / 2);
      const dy = first.top + first.height / 2 - (last.top + last.height / 2);
      stage.style.transformOrigin = 'center center';
      stage.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      const t0 = performance.now();
      const ease = (t: number) => 1 - (1 - t) ** 3;
      const step = (now: number) => {
        if (!alive) return;
        const t = Math.min(1, (now - t0) / 800);
        const e = ease(t);
        stage.style.transform = `translate(${dx * (1 - e)}px, ${dy * (1 - e)}px) scale(${s + (1 - s) * e})`;
        if (!handed && t >= 1) {
          handed = true;
          goRef.current('/tv');
        }
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    let alive = true;
    const stop = mountLandingTv(stage, { reduce, onActivate: zoom });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      stop();
    };
  }, [router]);

  return (
    <div className={leaving ? 'landing is-leaving' : 'landing'}>
      <h1 className="landing-statement">{STATEMENT}</h1>
      <div
        ref={stageRef}
        className="landing-stage"
        role="link"
        tabIndex={0}
        aria-label="Open garpez.tv"
      />
    </div>
  );
}
