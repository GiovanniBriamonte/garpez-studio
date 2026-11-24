'use client'

import './eyes.css'
import { useEffect, useRef } from 'react';

type EyesCursorProps = {
  label?: string
  width?: number
  height?: number
  corner?: number
  eyeRatio?: number
  pupilRatio?: number
  gap?: number
  travel?: number
  gaze?: number
  ease?: number
  blink?: number
  blinkLen?: number
  jitter?: number
  motion?: boolean
  typeface?: string
  weight?: number
  background?: string
  sclera?: string
  pupilColor?: string
  labelColor?: string
}

export function EyesCursor({
  label = 'Explore',
  width = 128, height = 36, corner = 18,
  eyeRatio = 0.42, pupilRatio = 0.42, gap = 1,
  travel = 0.75, gaze = 26, ease = 0.08,
  blink = 3, blinkLen = 170, jitter = 0.3,
  motion = true,   // true = look where it moves
  typeface = 'var(--font-geist-sans), sans-serif', weight = 500,
  background = '#000000', sclera = '#ffffff',
  pupilColor = '#000000', labelColor = '#ffffff'
}: EyesCursorProps) {
  const pill = useRef<HTMLSpanElement>(null);

  // one source of truth: the button height drives every inner size
  const eye = height * eyeRatio;
  const pupil = eye * pupilRatio;
  // the pupil may never leave the sclera
  const room = Math.max(0, (eye - pupil) / 2 * 0.92) * travel;

  useEffect(() => {
    const root = pill.current;
    if (!root || !matchMedia('(pointer: fine)').matches) return;
    const eyes = [...root.querySelectorAll<HTMLElement>('.eye')];
    const px = eyes.map(() => 0), py = eyes.map(() => 0);
    let mx = 0, my = 0, x = 0, y = 0;
    let lx = 0, ly = 0, vx = 0, vy = 0;
    let scale = 0.7, over = false, blinkAt = -1, next = 0, id = 0;
    let seen = false;

    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (seen) return;
      x = mx;
      y = my;
      lx = mx;
      ly = my;
      seen = true;
    };
    addEventListener('pointermove', move, { passive: true });

    const loop = (t: number) => {
      if (!next) next = t + blink * 1000;
      if (blinkAt < 0 && t > next) {
        blinkAt = t;
        next = t + blink * 1000 * (1 + (Math.random() * 2 - 1) * jitter);
      }
      let lid = 1;
      if (blinkAt >= 0) {
        const k = (t - blinkAt) / blinkLen;
        if (k >= 1) blinkAt = -1;
        else if (k < 0.35) lid = 1 - k / 0.35;
        else if (k < 0.50) lid = 0;
        else lid = (k - 0.5) / 0.5;
        lid = Math.max(0.04, lid);
      }

      /* the set is one canvas: the mesh hit is an attribute, so check every frame */
      const under = document.elementFromPoint(mx, my);
      over = !!under?.closest('[data-eyes-target]');
      root.classList.toggle('is-on', over);

      x += (mx - x) * ease;
      y += (my - y) * ease;
      scale += ((over ? 1 : 0.7) - scale) * 0.2;
      root.style.transform =
        `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`;

      vx = vx * 0.82 + (mx - lx) * 0.18;
      vy = vy * 0.82 + (my - ly) * 0.18;
      lx = mx; ly = my;

      eyes.forEach((el, i) => {
        el.style.transform = `scaleY(${lid})`;
        let tx = 0, ty = 0;
        if (motion) {
          const sp = Math.hypot(vx, vy);
          if (sp > 0.02) {
            const amp = Math.min(sp / Math.max(gaze * 0.25, 1), 1);
            tx = (vx / sp) * amp * room;
            ty = (vy / sp) * amp * room;
          }
        } else {
          const r = root.getBoundingClientRect();
          const dx = mx - (r.left + r.width / 2);
          const dy = my - (r.top + r.height / 2);
          const d = Math.hypot(dx, dy) || 1;
          const amp = Math.min(d / gaze, 1);
          tx = (dx / d) * amp * room;
          ty = (dy / d) * amp * room;
        }
        px[i] += (tx - px[i]) * 0.3;
        py[i] += (ty - py[i]) * 0.3;
        const dot = el.firstElementChild;
        if (dot instanceof HTMLElement) dot.style.transform = `translate(${px[i]}px,${py[i]}px)`;
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);

    return () => {
      removeEventListener('pointermove', move);
      cancelAnimationFrame(id);
    };
  }, [eye, pupil, room, gaze, ease, blink, blinkLen, jitter, motion]);

  const eyeStyle = { width: eye, height: eye, background: sclera };
  const pupilStyle = { width: pupil, height: pupil, background: pupilColor,
                       left: (eye - pupil) / 2, top: (eye - pupil) / 2 };

  return (
    <span ref={pill} className="eyes-pill" aria-hidden style={{
      minWidth: width, height, borderRadius: corner,
      padding: `0 ${height * 0.44}px`, gap: height * 0.22,
      fontSize: height * 0.36, fontFamily: typeface, fontWeight: weight,
      background, color: labelColor
    }}>
      <span className="eyes">
        <span className="eye" style={eyeStyle}><i style={pupilStyle} /></span>
        <span className="eye" style={{ ...eyeStyle, marginLeft: gap }}><i style={pupilStyle} /></span>
      </span>
      {label}
    </span>
  );
}
