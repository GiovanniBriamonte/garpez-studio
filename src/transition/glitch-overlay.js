/*
 * Full-viewport glitch curtain, drawn at low resolution and scaled up with
 * hard pixels. It speaks the same language as the TV's channel change:
 * static, horizontal bands that slip sideways, a rolling bright bar.
 *
 *   level 0 → nothing, page fully visible
 *   level 1 → screen fully covered with static
 * In between, random horizontal bands are covered and the rest shows the
 * page through the tears. Bands are re-rolled at a jerky rate (stutter).
 */

const LOW_W = 320;
/* TV palette: the ladybug red + the head-switch hues of tv-engine */
const TINTS = ['#b85043', '#7a5ae6', '#4aaae6', '#5ad296', '#d25ad2'];

const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createGlitchOverlay(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const noise = document.createElement('canvas');
  const nx = noise.getContext('2d');
  let W = LOW_W;
  let H = 180;
  let img = null;
  let buf = null;

  let level = 0;
  let tween = null; // { from, to, t0, dur, ease, resolve }
  let raf = 0;
  let bands = [];
  let nextRoll = 0;
  let destroyed = false;

  function size() {
    const r = canvas.getBoundingClientRect();
    const aspect = Math.max(r.width, 1) / Math.max(r.height, 1);
    W = LOW_W;
    H = Math.max(2, Math.round(LOW_W / aspect));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      noise.width = W;
      noise.height = H;
      img = nx.createImageData(W, H);
      buf = new Uint32Array(img.data.buffer);
    }
  }

  function roll(L) {
    bands = [];
    const cover = L >= 0.999 ? 1 : Math.pow(L, 0.75);
    let y = 0;
    while (y < H) {
      const h = Math.round(rnd(2, 22));
      const r = Math.random();
      bands.push({
        y,
        h,
        on: Math.random() < cover,
        ox: Math.round(rnd(-0.18, 0.18) * W * Math.min(1, L * 1.4)),
        kind: r < 0.72 ? 'snow' : r < 0.9 ? 'black' : 'tint',
        tint: TINTS[(Math.random() * TINTS.length) | 0],
      });
      y += h;
    }
    nextRoll = performance.now() + rnd(40, 95);
  }

  function snow() {
    for (let i = 0; i < buf.length; i++) {
      const v = (Math.random() * 200) | 0;
      buf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
    }
    nx.putImageData(img, 0, 0);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (level <= 0.001) return;
    if (now >= nextRoll || !bands.length) roll(level);
    snow();
    for (const b of bands) {
      if (!b.on) continue;
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, b.y, W, b.h);
      if (b.kind === 'black') continue;
      ctx.globalAlpha = b.kind === 'tint' ? 0.35 : 0.75;
      ctx.drawImage(noise, 0, b.y, W, b.h, b.ox, b.y, W, b.h);
      ctx.drawImage(noise, 0, b.y, W, b.h, b.ox + (b.ox > 0 ? -W : W), b.y, W, b.h);
      if (b.kind === 'tint') {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = b.tint;
        ctx.fillRect(b.ox, b.y, W, b.h);
      }
      ctx.globalAlpha = 1;
    }
    /* bright tear lines */
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(255,245,220,${rnd(0.15, 0.5) * level})`;
      ctx.fillRect(rnd(-W * 0.2, W), Math.floor(rnd(0, H)), rnd(W * 0.1, W * 0.6), 1);
    }
    /* rolling bar, like the TV */
    const hy = ((now / 6) % (H + 60)) - 30;
    const g = ctx.createLinearGradient(0, hy - 20, 0, hy + 20);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.12 * level})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 20, W, 40);
  }

  function loop(now) {
    if (destroyed) return;
    if (tween) {
      const p = Math.min(1, (now - tween.t0) / tween.dur);
      level = tween.from + (tween.to - tween.from) * tween.ease(p);
      if (p >= 1) {
        const done = tween.resolve;
        tween = null;
        done();
      }
    }
    draw(now);
    canvas.classList.toggle('is-on', level > 0.001);
    if (tween || level > 0.001) raf = requestAnimationFrame(loop);
    else raf = 0;
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function to(target, dur, ease) {
    size();
    if (tween) tween.resolve();
    return new Promise((resolve) => {
      tween = { from: level, to: target, t0: performance.now(), dur: Math.max(1, dur), ease, resolve };
      kick();
    });
  }

  return {
    get level() {
      return level;
    },
    /** Ramp up to full cover. */
    cover(ms = 160) {
      return to(1, ms, easeIn);
    },
    /** Jump straight to full cover (the page that left already ended in static). */
    hold() {
      size();
      if (tween) {
        tween.resolve();
        tween = null;
      }
      level = 1;
      roll(1);
      draw(performance.now());
      canvas.classList.add('is-on');
      kick();
    },
    /** Tear open and fade out. */
    release(ms = 480) {
      return to(0, ms, easeOut);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
    },
  };
}
