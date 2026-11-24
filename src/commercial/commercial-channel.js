/*
 * The commercial channel: the brand-identity bag, cut in on a beat and then held.
 * Drawn into the television's own canvas, so it gets the glitch, the scanlines
 * and the bend of the glass. Type stays live so the price can become the button.
 */

const BLACK = "#000";
const PAPER = "#f4f4f2";
const DIM = "#9a9a9a";
const ORANGE = "#ff4c18";

const BEAT = 180;
const LEAD = 280;
/* Beats: brand, second line, the bag, five contents lines. The aside shares the last line. */
const LIST_BEAT = 3;
const PRICE_BEAT = LIST_BEAT + 5;
const LAND = PRICE_BEAT * BEAT + 130;
const METRO = LAND + 2000;

const COPY = {
  brand: "YOUR BRAND.",
  one: "ONE BAG.",
  contents: "CONTENTS",
  aside: "COMPLETE BRAND IDENTITY. DELIVERED IN ONE MONTH.",
  price: "€10.000",
  cta: "GET IT",
  email: "ciao@garpez.studio",
  subject: "The €10.000 brand identity",
  body: "Hi Garpez,\n\nI want the complete brand identity. One bag, delivered in one month, €10.000.\n\n",
};

const LIST = [
  ["01", "LOGO"],
  ["02", "TYPEFACE"],
  ["03", "COLOR SYSTEM"],
  ["04", "GUIDELINES"],
  ["05", "TEMPLATES"],
];

const KIT = { w: 730, h: 852 };

export function createCommercial({ W, H, scale, fonts, sfx, reduce }) {
  const pixFace = fonts.pix;
  const monoFace = fonts.mono;
  const kit = new Image();
  kit.src = "/commercial/kit.png";

  let t0 = 0;
  let hover = false;
  let pressedAt = 0;
  let heard = -1;
  let blinkStep = -1;
  let blinkUntil = 0;
  let hotBox = null;

  const pix = (size) => `500 ${size}px ${pixFace}`;
  const mono = (size) => `500 ${size}px ${monoFace}`;

  function put(c, text, x, y, f, color, align = "left", track = 0) {
    c.font = f;
    c.textAlign = align;
    c.textBaseline = "middle";
    if ("letterSpacing" in c) c.letterSpacing = track + "px";
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  function width(c, text, f, track = 0) {
    c.font = f;
    if ("letterSpacing" in c) c.letterSpacing = track + "px";
    return c.measureText(text).width;
  }
  function gone(elapsed, at) {
    return !reduce && elapsed < at;
  }
  /* Remaining travel after a hard cut. Null before the beat. */
  function slide(elapsed, at, from) {
    if (reduce) return 0;
    const t = elapsed - at;
    if (t < 0) return null;
    if (t >= 70) return 0;
    return from * (1 - t / 70);
  }
  /* A fall that stops on one hit. Null before the beat. */
  function fall(elapsed, at) {
    if (reduce) return 0;
    const t = elapsed - at;
    if (t < 0) return null;
    if (t < 110) {
      const p = t / 110;
      return -44 * (1 - p * p);
    }
    if (t < 158) return 3;
    return 0;
  }
  function slam(elapsed, at) {
    if (reduce) return 0;
    const t = elapsed - at;
    if (t < 0) return null;
    if (t < 80) {
      const p = t / 80;
      return -18 * (1 - p * p);
    }
    if (t < 122) return 2;
    return 0;
  }

  function wrapLines(c, text, max, f, track) {
    c.font = f;
    if ("letterSpacing" in c) c.letterSpacing = track + "px";
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && c.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  /* The poster, brought onto the tube: the bag is the centre, the words sit beside it, and the glass keeps a margin. */
  function layout(c) {
    const S = 0.37;
    const OX = (W - 1024 * S) / 2;
    const OY = (H - 726 * S) / 2;
    const X = (x) => OX + x * S;
    const Y = (y) => OY + y * S;

    const brandMax = (359 - 61) * S;
    let size = 18;
    while (size > 12 && width(c, COPY.brand, pix(size)) > brandMax) size -= 1;
    const brand = { x: X(61), y: Y(78), size };
    const one = { x: X(61), y: Y(138), size };

    const diskLeft = X(312);
    const textLeft = X(708);
    const textRight = Math.min(X(948), W - 30);
    let listSize = 8;
    const listTrack = 0.5;
    while (
      listSize > 6.5 &&
      width(c, "03 COLOR SYSTEM", mono(listSize), listTrack) > diskLeft - X(61) - 8
    ) {
      listSize -= 0.5;
    }
    const list = {
      x: X(61),
      y: Y(198),
      size: listSize,
      gap: (Y(424) - Y(214)) / 5,
      track: listTrack,
    };

    let diskW = textLeft - 8 - diskLeft;
    let diskH = diskW * (KIT.h / KIT.w);
    const diskTop = Y(116);
    const maxH = Y(592) - diskTop;
    if (diskH > maxH) {
      diskH = maxH;
      diskW = diskH * (KIT.w / KIT.h);
    }
    const disk = { x: diskLeft, y: diskTop, w: diskW, h: diskH };
    const column = disk.x + disk.w;

    /* Bigger bag, same centre. The type stays in its column. */
    const grow = 1.16;
    const cx = disk.x + disk.w / 2;
    const cy = disk.y + disk.h / 2;
    disk.w *= grow;
    disk.h *= grow;
    disk.x = cx - disk.w / 2;
    disk.y = cy - disk.h / 2;

    const price = {
      x: column + 8,
      y: Y(604),
      w: textRight - (column + 8),
      h: 28,
    };
    if (price.y + price.h > H - 24) price.y = H - 24 - price.h;

    const asideSize = 8;
    const asideTrack = 0.2;
    const lines = wrapLines(c, COPY.aside, Math.max(64, price.w), mono(asideSize), asideTrack);
    const asideGap = 11;
    const aside = {
      right: textRight,
      y: price.y - 14 - (lines.length - 1) * asideGap,
      lines,
      size: asideSize,
      gap: asideGap,
      track: asideTrack,
    };

    return { brand, one, list, disk, aside, price };
  }

  function cues(elapsed) {
    if (reduce || elapsed < 0) return;
    const beat = Math.min(PRICE_BEAT, Math.floor(elapsed / BEAT));
    if (beat <= heard) return;
    heard = beat;
    if (beat === PRICE_BEAT) sfx.coin();
    else sfx.tick();
  }
  function metronome(now, elapsed) {
    if (reduce || elapsed < METRO) return { lit: -1, blink: false };
    const step = Math.floor((elapsed - METRO) / 2000);
    if (step !== blinkStep) {
      blinkStep = step;
      blinkUntil = now + 48;
    }
    return {
      lit: ((step % LIST.length) + LIST.length) % LIST.length,
      blink: !hover && now < blinkUntil,
    };
  }
  function plate(c, box, label, inkOnBlack) {
    c.fillStyle = inkOnBlack ? BLACK : ORANGE;
    c.fillRect(box.x, box.y, box.w, box.h);
    let s = 18;
    while (s > 11 && width(c, label, pix(s)) > box.w - 18) s -= 1;
    put(c, label, box.x + box.w / 2, box.y + box.h / 2 + 1, pix(s), inkOnBlack ? ORANGE : PAPER, "center");
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
    pressedAt = Date.now();
    sfx.confirm();
    mail();
  }

  function draw(c, now) {
    const elapsed = now - t0;
    cues(elapsed);
    const pulse = metronome(now, elapsed);
    const box = layout(c);
    const pressed = now - pressedAt < 90;

    c.save();
    c.fillStyle = BLACK;
    c.fillRect(0, 0, W, H);

    const dy = fall(elapsed, 2 * BEAT);
    if (dy !== null && kit.complete && kit.naturalWidth) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(kit, box.disk.x, Math.round(box.disk.y + dy), box.disk.w, box.disk.h);
    }

    const brandX = slide(elapsed, 0, -42);
    if (brandX !== null) {
      put(c, COPY.brand, box.brand.x + brandX, box.brand.y, pix(box.brand.size), PAPER);
    }
    const oneX = slide(elapsed, BEAT, -42);
    if (oneX !== null) {
      put(c, COPY.one, box.one.x + oneX, box.one.y, pix(box.one.size), PAPER);
    }

    if (!gone(elapsed, LIST_BEAT * BEAT)) {
      put(c, COPY.contents, box.list.x, box.list.y, mono(box.list.size), DIM, "left", 1.4);
      const col = Math.ceil(width(c, "00", mono(box.list.size), box.list.track)) + 8;
      LIST.forEach(([n, label], i) => {
        if (gone(elapsed, (LIST_BEAT + i) * BEAT)) return;
        const y = box.list.y + 16 + i * box.list.gap;
        const on = i === pulse.lit;
        put(c, n, box.list.x, y, mono(box.list.size), on ? PAPER : DIM, "left", box.list.track);
        put(c, label, box.list.x + col, y, mono(box.list.size), on ? PAPER : DIM, "left", box.list.track);
      });
    }

    const asideX = slide(elapsed, (LIST_BEAT + LIST.length - 1) * BEAT, 22);
    if (asideX !== null) {
      box.aside.lines.forEach((line, i) => {
        put(
          c,
          line,
          box.aside.right + asideX,
          box.aside.y + i * box.aside.gap,
          mono(box.aside.size),
          PAPER,
          "right",
          box.aside.track,
        );
      });
    }

    const priceY = slam(elapsed, PRICE_BEAT * BEAT);
    if (priceY === null) hotBox = null;
    else {
      const rect = {
        x: box.price.x,
        y: Math.round(box.price.y + priceY),
        w: box.price.w,
        h: box.price.h,
      };
      hotBox = rect;
      plate(c, rect, hover ? COPY.cta : COPY.price, (pulse.blink && !hover) || pressed);
    }

    c.restore();
    if ("letterSpacing" in c) c.letterSpacing = "0px";
  }

  function hit(x, y) {
    const r = hotBox;
    if (!r) return false;
    return x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 8 && y <= r.y + r.h + 8;
  }
  function pointer(type, x, y) {
    if (type === "leave") {
      hover = false;
      return false;
    }
    const hot = hit(x, y);
    if (hot && !hover && type !== "tap") sfx.tick();
    hover = hot;
    if (type === "tap" && hot) grab();
    return hot;
  }
  function key(k) {
    if (k !== "Enter" && k !== " ") return false;
    grab();
    return true;
  }

  return {
    name: "COMMERCIAL",
    scale,
    draw,
    enter() {
      t0 = Date.now() + (reduce ? 0 : LEAD);
      hover = false;
      pressedAt = 0;
      heard = reduce ? PRICE_BEAT : -1;
      blinkStep = -1;
      blinkUntil = 0;
      hotBox = null;
    },
    leave() {
      hover = false;
    },
    key,
    pointer,
  };
}
