/*
 * Pixelated wave (after Osmo's "Pixelated Wave Transition").
 *
 * A band of square cells travels across the viewport. It never covers the
 * whole screen: behind the band the old page (a frozen copy, see freeze.js)
 * is cut away cell by cell, so ahead of the band you still see the old page
 * and behind it the new one. Cells are one colour with stepped opacities,
 * which is what makes them read as pixels over both pages.
 *
 * The cell layer is drawn one canvas pixel per cell and scaled up with hard
 * edges, so it costs almost nothing.
 */

export const WAVE_COLOR = '#ce343e';

/* target cell size in CSS px; the grid always fills the width exactly */
const CELL = 60;
/* how far the band front travels across the start times (0..1) */
const SPAN = 0.6;
/* random spread of each cell's start, makes the edges ragged */
const JITTER = 0.22;
/* how long each cell stays lit, min + random extra */
const LIFE = 0.2;
const LIFE_EXTRA = 0.18;
/* per-cell opacity: mostly solid, some see-through */
const ALPHAS = [1, 1, 1, 1, 0.85, 0.6, 0.35];

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/* stepped envelope over a cell's life: flicker in, hold, flicker out */
function envelope(f) {
  if (f < 0.14) return 0.35;
  if (f < 0.28) return 0.7;
  if (f < 0.74) return 1;
  if (f < 0.88) return 0.7;
  return 0.35;
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createPixelWave(canvas, color = WAVE_COLOR) {
  const ctx = canvas.getContext('2d', { alpha: true });
  let raf = 0;
  let destroyed = false;
  let run = null;

  function layout(dir) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const cols = Math.max(10, Math.round(vw / CELL));
    /* whole device pixels per cell, so the scaled canvas has no seams */
    const cellDev = Math.max(1, Math.round((vw / cols) * dpr));
    const size = cellDev / dpr;
    const rows = Math.ceil(vh / size);
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = `${cols * size}px`;
    canvas.style.height = `${rows * size}px`;
    const cells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const along = dir > 0 ? (x + 0.5) / cols : 1 - (x + 0.5) / cols;
        const start = along * SPAN + Math.random() * JITTER;
        const life = LIFE + Math.random() * LIFE_EXTRA;
        cells.push({
          x,
          y,
          start,
          life,
          /* the old page under this cell disappears somewhere mid-life */
          swap: start + life * (0.3 + Math.random() * 0.35),
          alpha: ALPHAS[(Math.random() * ALPHAS.length) | 0],
        });
      }
    }
    const end = Math.max(...cells.map((c) => c.start + c.life));
    return { cols, rows, size, cells, end };
  }

  /* union of the cells whose old page is still showing, merged into row runs */
  function ghostPath(g, p) {
    let d = '';
    const rects = [];
    for (let y = 0; y < g.rows; y++) {
      let runStart = -1;
      for (let x = 0; x <= g.cols; x++) {
        const keep = x < g.cols && p < g.cells[y * g.cols + x].swap;
        if (keep && runStart < 0) runStart = x;
        if (!keep && runStart >= 0) {
          /* shared integer edges, overlapped 1px so antialiasing cannot open a hairline */
          const l = Math.max(0, Math.round(runStart * g.size) - 1);
          const t = Math.max(0, Math.round(y * g.size) - 1);
          const r = Math.round(x * g.size) + 1;
          const b = Math.round((y + 1) * g.size) + 1;
          rects.push({ l, t, r, b });
          d += `M${l} ${t}H${r}V${b}H${l}Z`;
          runStart = -1;
        }
      }
    }
    // #region agent log
    if (!ghostPath.logged) {
      ghostPath.logged = true;
      let pos = 0;
      let maxGap = 0;
      const samples = [];
      for (let i = 1; i < rects.length; i++) {
        const prev = rects[i - 1];
        const gap = rects[i].t - prev.b;
        if (gap > 0) {
          pos += 1;
          if (gap > maxGap) maxGap = gap;
          if (samples.length < 6) samples.push({ y: i, gap });
        }
      }
      fetch('http://127.0.0.1:7842/ingest/d39d7bc2-d6f8-4177-b62e-b13b15eee9ee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eb7faf'},body:JSON.stringify({sessionId:'eb7faf',runId:'post-fix',hypothesisId:'A',location:'pixel-wave.js:ghostPath',message:'clip row seams',data:{vw:window.innerWidth,vh:window.innerHeight,dpr:window.devicePixelRatio,cols:g.cols,rows:g.rows,size:g.size,cellDev:Math.round(g.size*(window.devicePixelRatio||1)),rects:rects.length,openGaps:pos,maxGap,samples},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return d;
  }

  function paint(g, p) {
    ctx.clearRect(0, 0, g.cols, g.rows);
    ctx.fillStyle = color;
    for (const c of g.cells) {
      const f = (p - c.start) / c.life;
      if (f <= 0 || f >= 1) continue;
      ctx.globalAlpha = c.alpha * envelope(f);
      ctx.fillRect(c.x, c.y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (destroyed || !run) return;
    const t = Math.min(1, (now - run.t0) / run.dur);
    const p = easeInOut(t) * run.g.end;
    paint(run.g, p);
    run.ghost?.clip(ghostPath(run.g, p));
    if (t < 1) {
      raf = requestAnimationFrame(loop);
      return;
    }
    const done = run.resolve;
    run.ghost?.remove();
    run = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('is-on');
    done();
  }

  return {
    /**
     * @param {number} [dir]
     * @param {number} [ms]
     * @param {{ clip: (d: string) => void, remove: () => void } | null} [ghost]
     * One pass across the screen. `dir` 1 = left→right, -1 = right→left.
     * `ghost` is the frozen old page from freezePage(); it is cut away as the
     * band passes and removed at the end.
     */
    sweep(dir = 1, ms = 1000, ghost = null) {
      cancelAnimationFrame(raf);
      if (run) {
        run.ghost?.remove();
        run.resolve();
      }
      return new Promise((resolve) => {
        ghostPath.logged = false;
        const g = layout(dir);
        run = { g, ghost, t0: performance.now(), dur: ms, resolve };
        canvas.classList.add('is-on');
        paint(g, 0);
        raf = requestAnimationFrame(loop);
      });
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      run?.ghost?.remove();
    },
  };
}
