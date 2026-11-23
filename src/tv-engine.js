import { createAudio } from "./audio.js";
import { createAbout } from "./about/about-channel.js";
import { createCommercial } from "./commercial/commercial-channel.js";
import geo from "./tv-geometry.json";

const SPRITE = geo.sprite;
/* How much the tube glass bends the picture; shared by the shader and the pointer mapping. */
const CURVE_X = 0.009,
  CURVE_Y = 0.013;
function family(variable, fallback) {
  const stack = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return stack || fallback;
}

/**
 * Starts the television inside `root`; `videos` ({ name, src }) become the first channels,
 * `models` lists the character files found in /public/about for the ABOUT channel.
 * Returns a function that stops it.
 *
 * A channel is { name, draw(c, now) } plus, optionally: `video`, `amb`, `info`, and for
 * playable channels `enter()`, `leave()`, `key(k)` and `pointer(type, x, y, kind)`.
 * Channels always draw in a W x H space; one that sets `scale` gets that many times the definition.
 */
export function mountTv(root, videos = [], models = []) {
  const $ = (id) => root.querySelector("#" + id);
  const tube = $("tube"),
    infoEl = $("info"),
    screen = $("screen");
  const cv = $("c"),
    ctx = cv.getContext("2d");
  const W = cv.width,
    H = cv.height;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const src = mk(),
    sx = src.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const tri = (x, r) => r - Math.abs((((x % (2 * r)) + 2 * r) % (2 * r)) - r);
  const pad = (n) => String(n).padStart(2, "0");
  const F_PIX = family("--font-geist-pixel-square", "ui-monospace, monospace");
  const F_SANS = family("--font-geist-sans", "ui-sans-serif, system-ui, sans-serif");
  const F_MONO = family("--font-geist-mono", "ui-monospace, monospace");
  const F_AD = family("--font-fredoka", "ui-rounded, ui-sans-serif, system-ui, sans-serif");
  const F_DOT = family("--font-doto", "ui-monospace, monospace");
  const F_UI = family("--font-chakra", "ui-sans-serif, system-ui, sans-serif");
  /* Definition of the picture: the canvases hold W*S x H*S pixels, drawing stays in W x H. */
  let S = 1;
  function setScale(n) {
    S = n;
    for (const c of [cv, src]) {
      c.width = W * S;
      c.height = H * S;
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
    sx.setTransform(S, 0, 0, S, 0, 0);
  }
  let power = false,
    ch = 0,
    raf = 0,
    muted = false,
    busy = false;
  const sound = createAudio(() => muted);
  const { sfx, setAmbience, timers } = sound;

  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    return () => target.removeEventListener(type, fn, opts);
  };
  const cleanups = [];

  function screensaver(c, now) {
    c.fillStyle = "#d8d1c2";
    c.fillRect(0, 0, W, H);
    const cell = 9,
      sw = SPRITE.w * cell,
      sh = SPRITE.h * cell,
      t = now / 1000;
    const x = Math.round(tri(t * 53, W - sw)),
      y = Math.round(tri(t * 37, H - sh));
    for (const [cx, cy, col] of SPRITE.px) {
      c.fillStyle = col;
      c.fillRect(x + cx * cell, y + cy * cell, cell, cell);
    }
  }
  const OPEN = "YOUR PROJECT";
  function noSignal(c, now) {
    snow(c, 1);
    c.fillStyle = "rgba(0,0,0,.55)";
    c.fillRect(W * 0.08, H * 0.4, W * 0.84, H * 0.2);
    c.font = "500 40px " + F_PIX;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const j = Math.sin(now / 90) * 2;
    c.globalCompositeOperation = "lighter";
    c.fillStyle = "#f0f";
    c.fillText(OPEN, W / 2 - 3 + j, H / 2);
    c.fillStyle = "#0f6";
    c.fillText(OPEN, W / 2 + 3 - j, H / 2 + 2);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#fff";
    c.fillText(OPEN, W / 2, H / 2 + 1);
  }
  function videoChannel(el) {
    return (c, now) => {
      c.fillStyle = "#000";
      c.fillRect(0, 0, W, H);
      if (el.readyState < 2) {
        snow(c, 0.6);
        return;
      }
      const k = Math.min(W / el.videoWidth, H / el.videoHeight),
        w = el.videoWidth * k,
        h = el.videoHeight * k;
      c.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
    };
  }
  function videoEl(src) {
    const v = document.createElement("video");
    v.src = src;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.muted = muted;
    return v;
  }
  const CH = [
    ...videos.map(({ name, src }) => {
      const v = videoEl(src);
      return { name, draw: videoChannel(v), video: v };
    }),
    { name: "SCREENSAVER", draw: screensaver },
    { name: OPEN, draw: noSignal, amb: "static" },
    {
      name: "INFO",
      draw: (c) => {
        c.fillStyle = "#343434";
        c.fillRect(0, 0, W, H);
      },
      info: true,
    },
  ];
  /* Sharp enough for the type on COMMERCIAL and ABOUT. */
  const picture = Math.min(
    3,
    Math.max(2, Math.ceil((screen.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) / W)),
  );
  /* COMMERCIAL takes the slot in front of ABOUT. With the two videos on air it is channel 3;
     ABOUT stays channel 4, wherever the videos end. */
  const commercial = createCommercial({
    W,
    H,
    scale: picture,
    fonts: { pix: F_PIX, display: F_AD, sans: F_SANS, mono: F_MONO },
    sfx,
    reduce,
  });
  const about = createAbout({
    W,
    H,
    scale: picture,
    sprite: SPRITE,
    fonts: { ui: F_UI, dot: F_DOT },
    sfx,
    reduce,
    models,
  });
  CH.splice(Math.min(2, CH.length), 0, commercial);
  CH.splice(Math.min(3, CH.length), 0, about);

  const nimg = ctx.createImageData(W, H),
    nbuf = new Uint32Array(nimg.data.buffer);
  const ncv = mk(),
    nx = ncv.getContext("2d");
  function snow(c, alpha) {
    for (let i = 0; i < nbuf.length; i++) {
      const v = (Math.random() * 255) | 0;
      nbuf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
    }
    nx.putImageData(nimg, 0, 0);
    c.save();
    c.globalAlpha = alpha;
    c.drawImage(ncv, 0, 0);
    c.restore();
  }
  const BAND_BOX = 8;
  const bandImg = ctx.createImageData(W, BAND_BOX),
    bandBuf = new Uint32Array(bandImg.data.buffer);
  const bandCv = document.createElement("canvas");
  bandCv.width = W;
  bandCv.height = BAND_BOX;
  const bandCx = bandCv.getContext("2d");
  const HUES = [
    [150, 90, 230],
    [100, 110, 255],
    [70, 170, 230],
    [90, 210, 150],
    [210, 90, 210],
  ];
  const SEG = 14,
    segs = Array.from({ length: Math.ceil(W / SEG) + 1 }, () => ({
      top: 0,
      th: 0,
    }));
  let tear = 26,
    lastSeg = 0;
  function headSwitch(c, t) {
    const y0 = H - BAND_BOX - 9;
    tear += (18 + Math.sin(t / 700) * 10 - tear) * 0.1 + rnd(-1.5, 1.5);
    if (t - lastSeg > 400) {
      lastSeg = t;
      for (let n = 0; n < 2; n++) {
        const sg = segs[(Math.random() * segs.length) | 0];
        sg.top = Math.random() < 0.6 ? 0 : rnd(-0.5, 0.5);
        sg.th = 0;
      }
    }
    for (let x = 0; x < W; x++) {
      const sg = segs[(x / SEG) | 0];
      const wave = Math.sin(x * 0.03 + t * 0.0008) * 0.2;
      const top = Math.max(
        0,
        Math.min(BAND_BOX - 2, Math.round(2.5 + wave + sg.top)),
      );
      const bot = Math.max(
        top + 1,
        Math.min(BAND_BOX, Math.round(top + 2.6 + sg.th)),
      );
      const start = Math.max(0, tear * (1 - top / BAND_BOX) + rnd(-2, 2));
      for (let y = 0; y < BAND_BOX; y++) {
        let px;
        if (y < top) px = 0;
        else if (y >= bot || x < start) px = 0xff000000;
        else {
          const hc = HUES[(Math.random() * HUES.length) | 0],
            k = 0.4 + Math.random() * 0.6,
            a = ((0.08 + Math.random() * 0.12) * 255) | 0;
          px =
            (a << 24) |
            (((hc[2] * k) | 0) << 16) |
            (((hc[1] * k) | 0) << 8) |
            ((hc[0] * k) | 0);
        }
        bandBuf[y * W + x] = px;
      }
    }
    bandCx.putImageData(bandImg, 0, 0);
    c.drawImage(bandCv, 0, y0);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = `rgba(255,236,170,${rnd(0.04, 0.1)})`;
      c.fillRect(rnd(0, W), y0 + 1 - Math.floor(rnd(0, 2)), rnd(6, 22), 1);
    }
    c.fillStyle = "#000";
    c.fillRect(0, y0 + BAND_BOX, W, H);
  }

  let tr = null,
    osdUntil = 0;
  function startTransition(extra = 0) {
    tr = {
      t0: performance.now(),
      dur: (reduce ? 80 : 240) + extra,
      ph: rnd(0, 6),
      bands: [0, 1, 2].map(() => ({
        y: rnd(0, H),
        h: rnd(14, 50),
        o: rnd(-40, 40),
      })),
    };
    return tr.dur;
  }
  function osd(c) {
    c.save();
    c.textAlign = "right";
    c.textBaseline = "top";
    c.font = "500 26px " + F_PIX;
    const w1 = c.measureText("CH 00").width;
    c.font = "500 16px " + F_PIX;
    const bw = Math.max(w1, c.measureText(CH[ch].name).width) + 14;
    const x = W - 18,
      y = 20;
    c.fillStyle = "rgba(0,0,0,.78)";
    c.fillRect(x - bw, y, bw, 48);
    c.font = "500 26px " + F_PIX;
    c.fillStyle = "#39ff5a";
    c.fillText("CH " + pad(ch + 1), x - 8, y + 3);
    c.font = "500 16px " + F_PIX;
    c.fillText(CH[ch].name, x - 8, y + 28);
    if (muted) {
      c.textAlign = "left";
      c.fillText("MUTE", 24, 20);
    }
    c.restore();
  }

  const glc = $("gl");
  let gl = null,
    glTex = null;
  (function initGL() {
    try {
      gl = glc.getContext("webgl", {
        antialias: false,
        premultipliedAlpha: false,
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return;
    const vs =
      "attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }";
    const fs = `precision mediump float;
      varying vec2 v; uniform sampler2D t; uniform vec2 res;
      const float CURVE_X = ${CURVE_X}, CURVE_Y = ${CURVE_Y};
      const float FRINGE = .0012;
      const float GLOW = .8;
      vec2 bend(vec2 u) { u = u * 2. - 1.; u += u * (u.yx * u.yx) * vec2(CURVE_X, CURVE_Y); return u * .5 + .5; }
      vec3 hi(vec2 u) { return max(texture2D(t, u).rgb - .68, 0.); }
      void main() {
        vec2 u = bend(v);
        if (u.x < 0. || u.x > 1. || u.y < 0. || u.y > 1.) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
        vec2 d = u - .5; float r2 = dot(d, d);
        vec2 ca = d * (FRINGE + .006 * r2);
        vec3 c = vec3(texture2D(t, u + ca).r, texture2D(t, u).g, texture2D(t, u - ca).b);
        vec3 b = vec3(0.); vec2 px = 1. / res;
        for (int i = 0; i < 10; i++) {
          float a = float(i) * .6283; vec2 o = vec2(cos(a), sin(a)) * px;
          b += hi(u + o * 2.) + hi(u + o * 4.5) * .7 + hi(u + o * 8.) * .45;
        }
        c += b * (GLOW / 21.5);
        float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, 1.25); c = (c - .5) * 1.05 + .5; c *= 1.04;
        c *= .88 + .12 * sin((u.y * res.y - .25) * 6.2832);
        float m = mod(gl_FragCoord.x, 3.);
        c *= m < 1. ? vec3(1., .93, .93) : (m < 2. ? vec3(.93, 1., .93) : vec3(.93, .93, 1.));
        gl_FragColor = vec4(c, 1.);
      }`;
    const sh = (type, source) => {
      const o = gl.createShader(type);
      gl.shaderSource(o, source);
      gl.compileShader(o);
      return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null;
    };
    const v = sh(gl.VERTEX_SHADER, vs),
      f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) {
      gl = null;
      return;
    }
    const pr = gl.createProgram();
    gl.attachShader(pr, v);
    gl.attachShader(pr, f);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      gl = null;
      return;
    }
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    glTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(pr, "res"), W, H);
    cleanups.push(
      listen(glc, "webglcontextlost", (e) => {
        e.preventDefault();
        gl = null;
        tube.classList.remove("gl");
      }),
    );
    tube.classList.add("gl");
  })();
  function sizeGL() {
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(glc.clientWidth * dpr)),
      h = Math.max(1, Math.round(glc.clientHeight * dpr));
    if (glc.width !== w || glc.height !== h) {
      glc.width = w;
      glc.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  function drawGL() {
    if (!gl) return;
    sizeGL();
    gl.bindTexture(gl.TEXTURE_2D, glTex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cv);
    } catch (e) {
      gl = null;
      tube.classList.remove("gl");
      return;
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const spillCv = $("spill"),
    spx = spillCv.getContext("2d");
  const spillImg = new Image();
  spillImg.src = "/assets/spill.webp";
  const probe = document.createElement("canvas");
  probe.width = 6;
  probe.height = 5;
  const pbx = probe.getContext("2d", { willReadFrequently: true });
  let glowCol = [0, 0, 0];
  function updateSpill(level) {
    pbx.drawImage(cv, 0, 0, 6, 5);
    let d;
    try {
      d = pbx.getImageData(0, 0, 6, 5).data;
    } catch (e) {
      return;
    }
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4,
      k = 0.35;
    glowCol = [
      glowCol[0] + (r / n - glowCol[0]) * k,
      glowCol[1] + (g / n - glowCol[1]) * k,
      glowCol[2] + (b / n - glowCol[2]) * k,
    ];
    paintSpill(glowCol.map((v) => v * level));
  }
  function paintSpill(col) {
    spx.globalCompositeOperation = "source-over";
    spx.clearRect(0, 0, 1600, 900);
    if (!spillImg.complete || Math.max(...col) < 1) return;
    spx.fillStyle = `rgb(${Math.min(255, col[0] * 1.15) | 0},${Math.min(255, col[1] * 1.15) | 0},${Math.min(255, col[2] * 1.15) | 0})`;
    spx.fillRect(0, 0, 1600, 900);
    spx.globalCompositeOperation = "destination-in";
    spx.drawImage(spillImg, 0, 0, 1600, 900);
  }

  let pw = null;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function tubeState(t) {
    if (!pw) return power ? [1, 1, 1] : [0, 0, 0];
    const p = Math.min(1, (t - pw.t0) / pw.dur);
    if (reduce) return pw.dir > 0 ? [1, 1, p] : [1, 1, 1 - p];
    if (pw.dir > 0) {
      if (p < 0.3) {
        const q = ease(p / 0.3);
        return [0.02 + q * 0.98, 0.004, 7];
      }
      if (p < 0.62) {
        const q = ease((p - 0.3) / 0.32);
        return [1, 0.004 + q * 0.996, 7 - q * 4.4];
      }
      return [1, 1, 2.6 - ease((p - 0.62) / 0.38) * 1.6];
    }
    if (p < 0.32) {
      const q = p / 0.32;
      return [1, 1 - q * q * 0.996, 1 + q * 8];
    }
    if (p < 0.6) {
      const q = (p - 0.32) / 0.28;
      return [1 - ease(q) * 0.988, 0.004, 9 + q * 3];
    }
    if (p < 0.85) return [0.012, 0.004, 12];
    const q = (p - 0.85) / 0.15;
    return [0.012 * (1 - q), 0.004 * (1 - q), 12 * (1 - q)];
  }

  let lastSpill = 0,
    infoShown = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = performance.now(),
      now = Date.now();
    if ((CH[ch].scale || 1) !== S) setScale(CH[ch].scale || 1);
    CH[ch].draw(sx, now);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    let showOsd = t < osdUntil;
    if (tr) {
      const e = t - tr.t0;
      if (e < tr.dur && !reduce) {
        const amp = Math.pow(1 - e / tr.dur, 2);
        for (let y = 0; y < H; y += 2) {
          let o = Math.sin(y * 0.07 + tr.ph + t * 0.03) * 22 * amp;
          for (const b of tr.bands)
            if (y > b.y && y < b.y + b.h) o += b.o * amp;
          o = Math.round(o);
          ctx.drawImage(src, 0, y * S, W * S, 2 * S, o, y, W, 2);
          ctx.drawImage(src, 0, y * S, W * S, 2 * S, o + (o > 0 ? -W : W), y, W, 2);
        }
        snow(ctx, 0.14 * amp);
        showOsd = false;
      } else {
        if (e >= tr.dur) tr = null;
        ctx.drawImage(src, 0, 0, W, H);
      }
    } else ctx.drawImage(src, 0, 0, W, H);
    if (!reduce) {
      /* channels drawn sharper (ABOUT) get less snow, so the picture stays readable */
      snow(ctx, S > 1 ? 0.02 : 0.05);
      const hy = ((t / 14) % (H + 120)) - 60;
      const g = ctx.createLinearGradient(0, hy - 40, 0, hy + 40);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,.05)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, hy - 40, W, 80);
    }
    const showInfo =
      power && !!CH[ch].info && !tr && !(pw && pw.dir < 0 && t - pw.t0 > 120);
    if (showInfo !== infoShown) {
      infoShown = showInfo;
      infoEl.classList.toggle("show", showInfo);
    }
    if (showOsd && !CH[ch].info) osd(ctx);
    if (!reduce) headSwitch(ctx, t);
    drawGL();

    const [ax, ay, br] = tubeState(t);
    tube.style.visibility = ax > 0 ? "visible" : "hidden";
    tube.style.transform = `scale(${ax}, ${ay})`;
    tube.style.filter = br === 1 ? "" : `brightness(${br})`;
    const level = Math.min(2.2, br * Math.max(ax * ay, ax * ay > 0 ? 0.02 : 0));
    if (t - lastSpill > 33 || pw) {
      lastSpill = t;
      updateSpill(level);
    }
    if (pw && t - pw.t0 >= pw.dur) {
      const done = pw.dir;
      pw = null;
      busy = false;
      if (done < 0) {
        power = false;
        syncVideos();
        tr = null;
        cancelAnimationFrame(raf);
        paintSpill([0, 0, 0]);
        tube.style.visibility = "hidden";
      }
    }
  }

  function syncVideos() {
    for (const c of CH)
      if (c.video) {
        const v = c.video,
          on = power && CH[ch] === c;
        if (on && v.paused) {
          try {
            if (v.duration) v.currentTime = (Date.now() / 1000) % v.duration;
          } catch (e) {}
          const pr = v.play();
          if (pr) pr.catch(() => {});
        } else if (!on && !v.paused) v.pause();
      }
    syncLive();
  }
  /* Tells playable channels when they go on and off air. */
  let live = null;
  function syncLive() {
    const next = power ? CH[ch] : null;
    if (next === live) return;
    if (live && live.leave) live.leave();
    live = next;
    screen.style.cursor = "";
    if (live && live.enter) live.enter();
  }
  function setChannel(n) {
    sfx.click();
    if (!power || busy) return;
    ch = ((n % CH.length) + CH.length) % CH.length;
    const dur = startTransition();
    syncVideos();
    setAmbience(null);
    sfx.static(dur);
    timers.amb = setTimeout(() => {
      if (power) setAmbience(CH[ch].amb);
    }, dur);
    osdUntil = performance.now() + dur + 2400;
  }
  function togglePower() {
    if (busy) return;
    busy = true;
    if (!power) {
      power = true;
      sfx.on();
      glowCol = [255, 255, 255];
      pw = { dir: 1, t0: performance.now(), dur: reduce ? 200 : 650 };
      cancelAnimationFrame(raf);
      frame();
      syncVideos();
      const d = startTransition(160);
      setAmbience(null);
      osdUntil = performance.now() + d + 2600;
      timers.amb = setTimeout(() => {
        if (power) setAmbience(CH[ch].amb);
      }, d);
    } else {
      sfx.off();
      setAmbience(null);
      glowCol = [255, 255, 255];
      pw = { dir: -1, t0: performance.now(), dur: reduce ? 200 : 700 };
    }
  }
  let prevCh = 0;
  function openInfo() {
    const i = CH.findIndex((c) => c.info);
    if (power && !busy && ch !== i) prevCh = ch;
    setChannel(ch === i ? prevCh : i);
  }
  function toggleMute() {
    muted = !muted;
    if (sound.master) sound.master.gain.value = muted ? 0 : 1;
    for (const c of CH) if (c.video) c.video.muted = muted;
    osdUntil = performance.now() + 1500;
  }

  const pressed = [...root.querySelectorAll(".pressed")],
    shades = [...root.querySelectorAll(".shade")],
    btns = [...root.querySelectorAll(".btn")];
  function hold(k, down) {
    shades[k].classList.toggle("show", down);
  }
  function press(k) {
    hold(k, true);
    clearTimeout(pressed[k]._t);
    pressed[k]._t = setTimeout(() => hold(k, false), 130);
  }
  const act = [
    openInfo,
    () => setChannel(ch - 1),
    () => setChannel(ch + 1),
    togglePower,
  ];
  btns.forEach((b, k) => {
    cleanups.push(
      listen(b, "pointerdown", (e) => {
        clearTimeout(pressed[k]._t);
        hold(k, true);
        try {
          b.setPointerCapture(e.pointerId);
        } catch (x) {}
      }),
    );
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
      cleanups.push(listen(b, ev, () => hold(k, false)));
    cleanups.push(
      listen(b, "click", (e) => {
        if (e.detail === 0) press(k);
        act[k]();
        b.blur();
      }),
    );
  });
  root.querySelectorAll(".remote button").forEach((r) =>
    cleanups.push(
      listen(r, "click", () => {
        const k = +r.dataset.for;
        press(k);
        act[k]();
      }),
    ),
  );
  const keyMap = {
    ArrowRight: 2,
    ArrowUp: 2,
    ArrowLeft: 1,
    ArrowDown: 1,
    p: 3,
    i: 0,
  };
  cleanups.push(
    listen(window, "keydown", (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      /* the channel on air gets first refusal, unless the key is aimed at a focused button */
      const onControl = e.target instanceof Element && e.target.closest("button, a");
      if (power && !busy && !onControl && CH[ch].key && CH[ch].key(k)) {
        e.preventDefault();
        return;
      }
      if (k === "m") return toggleMute();
      if (/^[1-9]$/.test(k)) {
        if (power && +k <= CH.length && +k - 1 !== ch) {
          press(2);
          setChannel(+k - 1);
        }
        return;
      }
      if (!(k in keyMap)) return;
      e.preventDefault();
      press(keyMap[k]);
      act[keyMap[k]]();
    }),
  );
  /* Where a pointer lands on the picture, in canvas pixels, following the bend of the glass. */
  function screenPoint(e) {
    const r = screen.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 2 - 1,
      y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (gl) [x, y] = [x + x * y * y * CURVE_X, y + y * x * x * CURVE_Y];
    return [(x * 0.5 + 0.5) * W, (y * 0.5 + 0.5) * H];
  }
  function point(type, e) {
    const c = CH[ch];
    if (!power || busy || !c.pointer) return;
    const hot =
      type === "leave"
        ? c.pointer(type)
        : c.pointer(type, ...screenPoint(e), e.pointerType);
    screen.style.cursor = hot ? "pointer" : "";
  }
  let sx0 = null;
  cleanups.push(
    listen(screen, "pointerdown", (e) => {
      sx0 = e.clientX;
    }),
  );
  cleanups.push(
    listen(screen, "pointerup", (e) => {
      if (sx0 === null) return;
      const dx = e.clientX - sx0;
      sx0 = null;
      if (Math.abs(dx) > 40) setChannel(ch + (dx < 0 ? 1 : -1));
      else if (e.button === 0) point("tap", e);
    }),
  );
  cleanups.push(listen(screen, "pointermove", (e) => point("move", e)));
  cleanups.push(listen(screen, "pointerleave", (e) => point("leave", e)));
  cleanups.push(
    listen(document, "visibilitychange", () => {
      if (sound.ac)
        (document.hidden ? sound.ac.suspend() : sound.ac.resume()).catch(
          () => {},
        );
    }),
  );
  if (document.fonts && document.fonts.load) {
    const first = (stack) => {
      const m = stack.match(/["']([^"']+)["']/);
      return m ? m[1] : stack.split(",")[0].trim();
    };
    document.fonts.load(`500 20px "${first(F_PIX)}"`);
    document.fonts.load(`700 64px "${first(F_AD)}"`);
    document.fonts.load(`800 72px "${first(F_SANS)}"`);
    document.fonts.load(`500 16px "${first(F_SANS)}"`);
    document.fonts.load(`800 80px "${first(F_MONO)}"`);
    document.fonts.load(`900 40px "${first(F_DOT)}"`);
    for (const style of ["500", "700", "italic 500", "italic 700"])
      document.fonts.load(`${style} 20px "${first(F_UI)}"`);
  }

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timers.amb);
    for (const el of pressed) clearTimeout(el._t);
    for (const fn of cleanups) fn();
    for (const c of CH) if (c.video && !c.video.paused) c.video.pause();
    if (live && live.leave) live.leave();
    live = null;
    about.dispose();
    setScale(1);
    sound.close();
  };
}
