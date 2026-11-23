/*
 * The commercial channel: one spot, drawn into the television's own canvas
 * so it gets the glitch, the scanlines and the bend of the glass.
 * Entering the channel plays the bumper, then the offer. It holds there.
 * Laid out in the W x H space of the tube; the engine supplies the extra definition.
 */

const INK = "#1a0a14";
const PINK = "#ff2d8a";
const PINK_DEEP = "#c4006e";
const YELLOW = "#ffe14a";
const CYAN = "#2ee6ff";
const ORANGE = "#ff7a18";
const LIME = "#c6ff3d";
const CREAM = "#fffdf6";

/* The bumper is the tease. Past this, the offer stays on screen. */
const BUMPER = 2500;

const COPY = {
  kicker: "AND NOW",
  line: "A WORD FROM",
  brand: "GARPEZ",
  offerKicker: "THIS MONTH ONLY",
  line1: "A COMPLETE",
  line2: "BRAND IDENTITY",
  line3: "IN ONE MONTH",
  price: "€10,000",
  cta: "GRAB IT",
  ctaHot: "WRITE US",
  email: "ciao@garpez.studio",
  subject: "The €10,000 brand identity",
  body: "Hi Garpez,\n\nI want the complete brand identity. One month, €10,000. Here's what I'm building:\n\n",
};

const RAYS = [
  YELLOW, PINK,
  "#fff6b0", ORANGE,
  YELLOW, "#ff5cb0",
  CREAM, PINK,
  YELLOW, ORANGE,
  LIME, PINK,
];
const STRIPES = [PINK, YELLOW, CYAN, LIME, ORANGE, CREAM, "#ff5cb0", YELLOW];

const clamp01 = (t) => Math.max(0, Math.min(1, t));
/* Soft overshoot, so a slam settles instead of bouncing across the tube. */
const back = (t) => {
  const c1 = 1.15;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const shown = (p) => clamp01(p);

export function createCommercial({ W, H, scale, fonts, sfx, reduce }) {
  const display = fonts.display;
  const pix = fonts.pix;
  let t0 = 0;
  let hover = false;
  let pressedAt = 0;
  let chimed = false;
  let stingTimer = 0;

  const face = (size, weight = 700) => `${weight} ${size}px ${display}`;
  const pixel = (size) => `${size}px ${pix}`;

  function put(c, text, x, y, f, color, align = "center") {
    c.font = f;
    c.textAlign = align;
    c.textBaseline = "middle";
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  function stamp(c, text, x, y, f, color, shadow, align) {
    if (shadow) put(c, text, x + 2, y + 2, f, shadow, align);
    put(c, text, x, y, f, color, align);
  }
  function fit(c, text, size, max) {
    let s = size;
    while (s > 16) {
      c.font = face(s);
      if ("letterSpacing" in c) c.letterSpacing = "0px";
      if (c.measureText(text).width <= max) return s;
      s -= 1;
    }
    return s;
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const rad = i % 2 ? r * 0.4 : r;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }
  function arrive(t, delay) {
    if (reduce) return 1;
    return back(clamp01((t - delay) / 420));
  }

  /* Settled positions. The glass clips the top and bottom, so the stack sits inside both. */
  function layout() {
    const head = { y: 52, h: 84 };
    const line3 = { y: 146, h: 28 };
    const price = { y: 184, h: 50 };
    const button = { x: (W - 208) / 2, y: 246, w: 208, h: 38 };
    return { button, price, line3, head };
  }
  function clock(now) {
    const elapsed = reduce ? BUMPER + 4000 : Math.max(0, now - t0);
    return {
      local: elapsed,
      offer: elapsed >= BUMPER,
      offerT: elapsed - BUMPER,
    };
  }
  function buttonRect(now) {
    const { offer, offerT } = clock(now);
    if (!offer) return null;
    const p = arrive(offerT, 560);
    if (p < 0.2) return null;
    const base = layout().button;
    const pressed = now - pressedAt < 150;
    const dy = (1 - p) * 26 + (pressed ? 3 : 0) - (hover && !pressed ? 1 : 0);
    return { x: base.x, y: base.y + dy, w: base.w, h: base.h, p, pressed };
  }
  function hit(rect, x, y) {
    return (
      !!rect &&
      x >= rect.x - 8 &&
      x <= rect.x + rect.w + 8 &&
      y >= rect.y - 8 &&
      y <= rect.y + rect.h + 8
    );
  }
  function mail() {
    const q = (s) => encodeURIComponent(s);
    const a = document.createElement("a");
    a.href = `mailto:${COPY.email}?subject=${q(COPY.subject)}&body=${q(COPY.body)}`;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
  }
  function grab() {
    sfx.confirm();
    pressedAt = Date.now();
    mail();
  }
  function skipBumper() {
    if (reduce) return;
    const now = Date.now();
    if (now - t0 >= BUMPER) return;
    t0 = now - BUMPER;
    sfx.cursor();
  }

  function stripes(c, now) {
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.2);
    const band = 42;
    const travel = reduce ? 0 : (now / 16) % band;
    const span = W + H;
    for (let i = -22; i <= 22; i++) {
      c.fillStyle = STRIPES[(i + 22) % STRIPES.length];
      c.fillRect(-span, i * band + travel, span * 2, band + 1);
    }
    c.restore();
  }
  function sun(c, now) {
    c.save();
    c.translate(W / 2, H * 0.46);
    c.rotate(reduce ? 0.4 : now / 1600);
    const n = RAYS.length;
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, 520, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      c.closePath();
      c.fillStyle = RAYS[i];
      c.fill();
    }
    c.restore();
  }
  /* A colored plank with a hard shadow. dx slides it in; p is the entrance, used as alpha. */
  function slab(c, text, y, h, size, fill, ink, dx, p) {
    const alpha = shown(p);
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    const s = fit(c, text, size, W - 56);
    const f = face(s);
    c.font = f;
    const w = Math.min(W - 24, Math.ceil(c.measureText(text).width) + 36);
    const x = (W - w) / 2 + dx;
    c.fillStyle = PINK_DEEP;
    c.fillRect(x + 5, y + 5, w, h);
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(255,255,255,.32)";
    c.fillRect(x, y, w, 3);
    stamp(c, text, x + w / 2, y + h / 2 + 1, f, ink, null);
    c.restore();
  }
  /* "A complete brand identity" is one plank: the small line sits on the big one. */
  function headline(c, y, h, dx, p) {
    const alpha = shown(p);
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    const big = fit(c, COPY.line2, 36, W - 64);
    const fBig = face(big);
    const fSmall = face(Math.max(16, big - 14));
    c.font = fBig;
    const w = Math.min(W - 24, Math.ceil(c.measureText(COPY.line2).width) + 40);
    const x = (W - w) / 2 + dx;
    c.fillStyle = PINK_DEEP;
    c.fillRect(x + 5, y + 5, w, h);
    c.fillStyle = PINK;
    c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(255,255,255,.32)";
    c.fillRect(x, y, w, 3);
    stamp(c, COPY.line1, x + w / 2, y + 26, fSmall, YELLOW, null);
    stamp(c, COPY.line2, x + w / 2, y + h - 28, fBig, CREAM, null);
    c.restore();
  }
  function bug(c, now) {
    const flip = !reduce && Math.floor(now / 420) % 2 === 0;
    const w = 36;
    const h = 18;
    const x = 12;
    const y = 12;
    c.fillStyle = PINK_DEEP;
    c.fillRect(x + 3, y + 3, w, h);
    c.fillStyle = flip ? PINK : YELLOW;
    c.fillRect(x, y, w, h);
    put(c, "AD", x + w / 2, y + h / 2 + 1, pixel(15), flip ? CREAM : INK);
  }
  function bumper(c, local) {
    const top = (H - 178) / 2;
    const a = arrive(local, 60);
    const b = arrive(local, 280);
    const d = arrive(local, 520);
    slab(c, COPY.kicker, top, 34, 22, YELLOW, INK, (1 - a) * -W, a);
    slab(c, COPY.line, top + 42, 36, 20, CREAM, INK, (1 - b) * W, b);
    c.save();
    c.translate(W / 2, top + 128);
    c.scale(0.72 + 0.28 * d, 0.72 + 0.28 * d);
    c.globalAlpha = shown(d);
    const s = fit(c, COPY.brand, 64, W - 80);
    const f = face(s);
    c.font = f;
    const w = Math.ceil(c.measureText(COPY.brand).width) + 40;
    const h = 84;
    c.fillStyle = PINK_DEEP;
    c.fillRect(-w / 2 + 6, -h / 2 + 6, w, h);
    c.fillStyle = PINK;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = "rgba(255,255,255,.32)";
    c.fillRect(-w / 2, -h / 2, w, 4);
    stamp(c, COPY.brand, 0, 2, f, YELLOW, PINK_DEEP);
    c.restore();
  }
  function priceMetrics(c, box) {
    const s = fit(c, COPY.price, 40, W - 96);
    const f = face(s);
    c.font = f;
    const w = Math.ceil(c.measureText(COPY.price).width) + 44;
    return { s, f, w, h: box.h, cx: W / 2, cy: box.y + box.h / 2 };
  }
  /* The prize burst sits behind the planks, so the type stays readable while the points peek out. */
  function priceBurst(c, now, box, p) {
    const alpha = shown(p);
    if (alpha <= 0) return;
    const { w, h, cx, cy } = priceMetrics(c, box);
    c.save();
    c.translate(cx, cy);
    c.rotate(reduce ? 0.3 : now / 900);
    c.scale(Math.max(0.72 + 0.28 * p, 0.01), Math.max(0.72 + 0.28 * p, 0.01));
    c.globalAlpha = alpha;
    star(c, 0, 0, Math.max(w * 0.62, h), 0);
    c.fillStyle = CREAM;
    c.fill();
    c.restore();
  }
  function pricePlate(c, now, box, p) {
    const alpha = shown(p);
    if (alpha <= 0) return;
    const { f, w, h, cx, cy } = priceMetrics(c, box);
    c.save();
    c.translate(cx, cy);
    c.scale(Math.max(0.72 + 0.28 * p, 0.01), Math.max(0.72 + 0.28 * p, 0.01));
    c.globalAlpha = alpha;
    c.fillStyle = PINK_DEEP;
    c.fillRect(-w / 2 + 5, -h / 2 + 5, w, h);
    c.fillStyle = YELLOW;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.lineWidth = 4;
    c.strokeStyle = PINK;
    c.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
    stamp(c, COPY.price, 0, 1, f, INK, null);
    c.restore();
  }
  function button(c, rect) {
    const { x, y, w, h, pressed } = rect;
    const hot = hover && !pressed;
    c.save();
    c.globalAlpha = shown(rect.p);
    c.translate(x + w / 2, y + h / 2);
    const pulse = reduce || hot ? 1 : 1 + Math.sin(Date.now() / 150) * 0.035;
    c.scale(hot ? 1.04 : pulse, hot ? 1.04 : pulse);
    c.fillStyle = PINK_DEEP;
    c.fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
    c.fillStyle = hot ? YELLOW : CREAM;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.lineWidth = 3;
    c.strokeStyle = PINK;
    c.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
    const label = hot ? COPY.ctaHot : COPY.cta;
    stamp(c, label, 0, 1, face(20), hot ? INK : PINK, null);
    c.restore();
  }
  function kicker(c, now, p) {
    const alpha = shown(p);
    if (alpha <= 0) return;
    const flip = !reduce && Math.floor(now / 420) % 2 === 0;
    const f = pixel(16);
    c.font = f;
    const w = Math.ceil(c.measureText(COPY.offerKicker).width) + 22;
    const h = 20;
    const x = (W - w) / 2;
    const y = 24 + (1 - shown(p)) * -12;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x + w / 2, y + h / 2);
    c.fillStyle = PINK_DEEP;
    c.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
    c.fillStyle = flip ? PINK : YELLOW;
    c.fillRect(-w / 2, -h / 2, w, h);
    put(c, COPY.offerKicker, 0, 1, f, flip ? CREAM : INK);
    c.restore();
  }

  /* One Figma pointer. It crosses the picture once, then stops on the button's bottom corner. */
  const FLIGHT = {
    color: "#1B9BFF",
    arrive: 4000,
    keys: [
      [0, 34, 32],
      [800, 292, 40],
      [1650, 52, 112],
      [2500, 328, 156],
      [3250, 118, 196],
    ],
    /* The arrow hangs down from its tip, so the tip stays up in the corner and the tail fills the bottom-left. */
    land: (btn) => [btn.x + 10, btn.y + btn.h - 34],
  };
  function flightPos(elapsed, flight, btn) {
    const [lx, ly] = flight.land(btn);
    if (reduce || elapsed >= flight.arrive) return [lx, ly];
    const keys = flight.keys.concat([[flight.arrive, lx, ly]]);
    let i = 0;
    while (i < keys.length - 2 && elapsed >= keys[i + 1][0]) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const p = clamp01((elapsed - a[0]) / (b[0] - a[0] || 1));
    const e = p * p * (3 - 2 * p);
    const flutter = b[0] >= flight.arrive ? 1 - p : 1;
    return [
      a[1] + (b[1] - a[1]) * e + Math.sin(elapsed / 150 + a[1]) * 8 * flutter,
      a[2] + (b[2] - a[2]) * e + Math.cos(elapsed / 180 + a[2]) * 6 * flutter,
    ];
  }
  /* The Figma pointer: arrow tip at the origin, tail down to the right, white edge so it reads on the candy. */
  function figmaCursor(c, x, y, color) {
    c.save();
    c.translate(x, y);
    c.scale(1.85, 1.85);
    c.beginPath();
    c.moveTo(0.2, 0.2);
    c.lineTo(0.2, 14.6);
    c.lineTo(3.9, 10.8);
    c.lineTo(6.7, 16.5);
    c.lineTo(8.8, 15.4);
    c.lineTo(6, 9.8);
    c.lineTo(10.8, 9.8);
    c.closePath();
    c.lineJoin = "miter";
    c.miterLimit = 2.5;
    c.lineWidth = 1.35;
    c.strokeStyle = "#fff";
    c.fillStyle = "rgba(16,8,20,.35)";
    c.save();
    c.translate(0.7, 0.8);
    c.fill();
    c.restore();
    c.stroke();
    c.fillStyle = color;
    c.fill();
    c.restore();
  }
  function cursors(c, elapsed) {
    const [x, y] = flightPos(elapsed, FLIGHT, layout().button);
    c.save();
    c.globalAlpha = reduce ? 1 : shown(elapsed / 220);
    figmaCursor(c, x, y, FLIGHT.color);
    c.restore();
  }

  function draw(c, now) {
    const { local, offer, offerT } = clock(now);
    c.save();
    if (offer) sun(c, now);
    else stripes(c, now);
    if (!offer) {
      hover = false;
      bumper(c, local);
      cursors(c, local);
    } else {
      const box = layout();
      const a = arrive(offerT, 40);
      const b = arrive(offerT, 140);
      const d = arrive(offerT, 280);
      const e = arrive(offerT, 420);
      priceBurst(c, now, box.price, e);
      kicker(c, now, a);
      headline(c, box.head.y, box.head.h, (1 - b) * -W, b);
      slab(c, COPY.line3, box.line3.y, box.line3.h, 18, CYAN, INK, (1 - d) * -W, d);
      pricePlate(c, now, box.price, e);
      const rect = buttonRect(now);
      if (rect) button(c, rect);
      cursors(c, local);
      if (!reduce && offerT > 620 && !chimed) {
        chimed = true;
        sfx.coin();
      }
    }
    bug(c, now);
    const cut = Math.max(
      local < 180 ? 1 - local / 180 : 0,
      offer && offerT < 160 ? 1 - offerT / 160 : 0,
      now - pressedAt < 140 ? 1 - (now - pressedAt) / 140 : 0,
    );
    if (cut > 0) {
      c.globalAlpha = cut * 0.85;
      c.fillStyle = CREAM;
      c.fillRect(0, 0, W, H);
    }
    c.restore();
    c.globalAlpha = 1;
    if ("letterSpacing" in c) c.letterSpacing = "0px";
  }

  function pointer(type, x, y) {
    if (type === "leave") {
      hover = false;
      return false;
    }
    const rect = buttonRect(Date.now());
    if (!rect) {
      hover = false;
      if (type === "tap") skipBumper();
      return false;
    }
    const hot = hit(rect, x, y);
    hover = hot;
    if (type === "tap" && hot) grab();
    return hot;
  }
  function key(k) {
    if (k !== "Enter" && k !== " ") return false;
    if (!buttonRect(Date.now())) {
      skipBumper();
      return true;
    }
    grab();
    return true;
  }

  return {
    name: "COMMERCIAL",
    scale,
    draw,
    enter() {
      t0 = Date.now();
      hover = false;
      pressedAt = 0;
      chimed = false;
      clearTimeout(stingTimer);
      if (!reduce) stingTimer = setTimeout(() => sfx.sting(), 300);
    },
    leave() {
      hover = false;
      clearTimeout(stingTimer);
    },
    key,
    pointer,
  };
}
