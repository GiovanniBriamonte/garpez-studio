/*
 * CH 04, PS2: a character select you can play.
 * loading -> title -> select -> chosen -> talk, all drawn into the television's own canvas,
 * so it gets the channel glitch, the scanlines and the bend of the glass for free.
 * Everything here is laid out in the W x H space of the TV; the engine supplies the extra definition.
 */
import { CREW, COPY } from "./crew.js";
import { createStage } from "./stage3d.js";

const CREAM = "#d8d1c2",
  RED = "#b85043",
  ORANGE = "#f08a4b",
  YELLOW = "#f2b51a",
  GREEN = "#39ff5a",
  INK = "#111",
  SKY = "#12121a", // top of the showroom
  HORIZON = "#2a2a34", // mid wall
  FLOOR = "#141418",
  LIGHT = "255,244,222"; // the spots
const DIM = "rgba(216,209,194,.55)";
const TYPE_SPEED = 48; // characters per second

const ease = (t) => 1 - Math.pow(1 - t, 3);

export function createAbout({ W, H, scale, sprite, fonts, sfx, reduce, models }) {
  const coarse = matchMedia("(pointer: coarse)").matches;

  let state = "loading",
    since = Date.now(),
    last = 0;
  let stage = null,
    ready = false,
    started = false,
    dead = false;
    let focus = 0, // who is on the turntable
    picked = 0,
    cardAt = 0,
    denied = 0, // last time a locked character refused a select
    chosenFor = 1.3,
    talk = null;

  const go = (next) => {
    state = next;
    since = Date.now();
  };
  function load() {
    if (started) return;
    started = true;
    const t0 = performance.now();
    createStage({
      W,
      H,
      scale,
      crew: CREW,
      models,
      reduce,
      palette: { floor: FLOOR, horizon: HORIZON, sky: SKY, accent: RED },
    })
      .catch((e) => {
        console.warn("ABOUT: 3D stage unavailable, showing the menus only", e);
        return null;
      })
      /* a console takes a moment to boot */
      .then((s) => new Promise((done) => setTimeout(() => done(s), Math.max(0, 900 - (performance.now() - t0)))))
      .then((s) => {
        if (dead) {
          if (s) s.dispose();
          return;
        }
        stage = s;
        ready = true;
        if (state === "loading") go("title");
      });
  }

  /* drawing helpers */
  const font = (size, weight = 500, italic = false, face = fonts.ui) =>
    `${italic ? "italic " : ""}${weight} ${size}px ${face}`;
  const put = (c, s, x, y, f, color, align = "left", track = 0) => {
    c.font = f;
    c.textAlign = align;
    c.textBaseline = "middle";
    if ("letterSpacing" in c) c.letterSpacing = track + "px";
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  /* text lifted off the picture by a soft shadow */
  const lift = (c, s, x, y, f, color, align, track) => {
    put(c, s, x + 1, y + 1.5, f, "rgba(0,0,0,.6)", align, track);
    put(c, s, x, y, f, color, align, track);
  };
  /* lifted text with the magenta and cyan fringe of the INFO channel */
  const fringe = (c, s, x, y, f, color, align, track) => {
    put(c, s, x + 1, y + 1.5, f, "rgba(0,0,0,.6)", align, track);
    put(c, s, x - 1, y, f, "rgba(255,0,200,.5)", align, track);
    put(c, s, x + 1, y, f, "rgba(0,255,220,.45)", align, track);
    put(c, s, x, y, f, color, align, track);
  };
  const round = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  const shade = (c, x0, y0, x1, y1, ...stops) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
    return g;
  };
  const arrow = (c, x, y, s, dir, color) => {
    c.fillStyle = color;
    c.beginPath();
    if (dir === "down") {
      c.moveTo(x - s, y - s * 0.6);
      c.lineTo(x + s, y - s * 0.6);
      c.lineTo(x, y + s * 0.6);
    } else {
      const k = dir === "left" ? -1 : 1;
      c.moveTo(x - k * s * 0.6, y - s);
      c.lineTo(x - k * s * 0.6, y + s);
      c.lineTo(x + k * s * 0.6, y);
    }
    c.fill();
  };
  const logo = (c, x, y, cell, squash = 1) => {
    const half = (sprite.w * cell) / 2;
    for (const [px, py, col] of sprite.px) {
      c.fillStyle = col;
      c.fillRect(
        Math.round(x + (px * cell - half) * squash),
        y + py * cell,
        Math.max(1, Math.ceil(cell * Math.abs(squash))),
        cell,
      );
    }
  };
  /* a smoked-glass panel */
  const panel = (c, x, y, w, h) => {
    round(c, x, y, w, h, 6);
    c.fillStyle = shade(c, 0, y, 0, y + h, "rgba(34,34,38,.86)", "rgba(10,10,12,.93)");
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = "rgba(255,255,255,.2)";
    c.stroke();
    c.fillStyle = shade(c, x, 0, x + w, 0, "rgba(255,255,255,0)", "rgba(255,255,255,.4)", "rgba(255,255,255,0)");
    c.fillRect(x + 6, y + 1, w - 12, 1);
  };
  /* a rule that fades out at both ends */
  const rule = (c, x, y, w, color) => {
    c.fillStyle = shade(c, x, 0, x + w, 0, "rgba(0,0,0,0)", color, "rgba(0,0,0,0)");
    c.fillRect(x, y, w, 1);
  };
  /* a pill with a label; returns its width */
  const pill = (c, s, x, y, f, on, align = "center") => {
    c.font = f;
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    const w = Math.ceil(c.measureText(s).width) + 14,
      left = align === "center" ? Math.round(x - w / 2) : x;
    round(c, left, y - 8, w, 16, 8);
    if (on) {
      c.fillStyle = shade(c, 0, y - 8, 0, y + 8, "#ffd65a", YELLOW);
      c.fill();
    } else {
      c.fillStyle = "rgba(0,0,0,.4)";
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = "rgba(255,255,255,.22)";
      c.stroke();
    }
    put(c, s, left + w / 2, y + 0.5, f, on ? INK : DIM, "center");
    return w;
  };
  /* a key of the keyboard; returns its width */
  const keycap = (c, label, x, y) => {
    const f = font(8.5, 700),
      glyph = label === "<" || label === ">";
    c.font = f;
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    const w = glyph ? 14 : Math.ceil(c.measureText(label).width) + 10;
    round(c, x, y - 6.5, w, 13, 3);
    c.fillStyle = "rgba(255,255,255,.1)";
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = "rgba(255,255,255,.55)";
    c.stroke();
    if (glyph) arrow(c, x + w / 2, y, 3.2, label === "<" ? "left" : "right", CREAM);
    else put(c, label, x + w / 2, y + 0.5, f, CREAM, "center");
    return w;
  };
  const wrap = (c, s, max) => {
    const out = [];
    let line = "";
    for (const word of s.split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (line && c.measureText(next).width > max) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  /* where character `i` stands on the picture, `height` units above its floor */
  const spot = (i, height) =>
    stage ? stage.at(i, height) : [W / 2 + (i - (CREW.length - 1) / 2) * 236, 222 - height * 90];

  function backdrop(c) {
    /* the 3D room fills the CRT; this is only a matching fallback while it loads */
    c.fillStyle = SKY;
    c.fillRect(0, 0, W, H);
    if (!stage) {
      c.fillStyle = shade(c, 0, 0, 0, H, SKY, HORIZON, FLOOR);
      c.fillRect(0, 0, W, H);
    }
  }
  /* a spot on character `i`: a glow on the wall behind and, with `beam`, the shaft of light itself */
  function spotlight(c, i, k, beam) {
    const [x, foot] = spot(i, 0),
      [, chest] = spot(i, 1.25);
    c.save();
    c.globalCompositeOperation = "lighter";
    const glow = c.createRadialGradient(x, chest, 6, x, chest, 130);
    glow.addColorStop(0, `rgba(${LIGHT},${0.34 * k})`);
    glow.addColorStop(1, `rgba(${LIGHT},0)`);
    c.fillStyle = glow;
    c.fillRect(x - 130, chest - 130, 260, 260);
    if (beam)
      for (const width of [1, 0.7, 0.42]) {
        c.fillStyle = shade(c, 0, 0, 0, foot, `rgba(${LIGHT},${0.1 * k})`, `rgba(${LIGHT},${0.025 * k})`);
        c.beginPath();
        c.moveTo(x - 11 * width, 0);
        c.lineTo(x + 11 * width, 0);
        c.lineTo(x + 56 * width, foot);
        c.lineTo(x - 56 * width, foot);
        c.fill();
      }
    c.restore();
  }

  function loadingScreen(c, now) {
    c.fillStyle = "#050506";
    c.fillRect(0, 0, W, H);
    const t = now / 1000,
      x = W - 150,
      y = H - 50;
    put(c, COPY.loading, x, y, font(12, 700, true), CREAM, "left", 2);
    for (let i = 0; i < 8; i++) {
      const lit = reduce || (Math.floor(t * 10) - i + 80) % 8 < 3;
      c.fillStyle = lit ? YELLOW : "rgba(255,255,255,.14)";
      c.fillRect(x + i * 11, y + 11, 8, 3);
    }
    logo(c, W - 32, H - 66, 3, reduce ? 1 : Math.cos(t * 5));
  }
  function titleScreen(c, now) {
    const t = now / 1000;
    logo(c, W / 2, 30 + (reduce ? 0 : Math.round(Math.sin(t * 2) * 3)), 5);
    fringe(c, COPY.title, W / 2, 124, font(50, 900, false, fonts.dot), CREAM, "center");
    rule(c, W / 2 - 80, 148, 160, YELLOW);
    lift(c, COPY.subtitle, W / 2, 161, font(11.5, 700, true), YELLOW, "center", 3);
    c.globalAlpha = reduce ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(t * 2.6));
    lift(c, coarse ? COPY.startTouch : COPY.start, W / 2, 236, font(17, 700), CREAM, "center", 2.5);
    c.globalAlpha = 1;
  }
  function hints(c, y) {
    const f = font(8.5, 700);
    if (coarse) return put(c, COPY.hintTouch, W / 2, y, f, DIM, "center", 1);
    /* measure, then draw centred */
    const run = (x, paint) => {
      COPY.hints.forEach(([keys, label], n) => {
        if (n) x += 14;
        for (const k of keys) x += (paint ? keycap(c, k, x, y) : k === "<" || k === ">" ? 14 : keyWidth(c, k)) + 3;
        c.font = f;
        if ("letterSpacing" in c) c.letterSpacing = "1px";
        if (paint) put(c, label, x + 2, y + 0.5, f, DIM, "left", 1);
        x += 2 + c.measureText(label).width;
      });
      return x;
    };
    run((W - run(0, false)) / 2, true);
  }
  const keyWidth = (c, label) => {
    c.font = font(8.5, 700);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    return Math.ceil(c.measureText(label).width) + 10;
  };
  /* The card and the quote share one pair of side edges. The arrows stop on those edges. */
  const frame = () => ({ y: H - 32, left: 34, right: W - 34 });
  /* The dialogue box uses the same side edges, and stays clear of the glass. */
  const talkBox = () => {
    const f = frame();
    return { x: f.left, y: 198, w: f.right - f.left, h: 84 };
  };
  function tri(c, x, y, dir) {
    c.fillStyle = YELLOW;
    c.beginPath();
    c.moveTo(x + dir * 9, y);
    c.lineTo(x - dir * 7, y - 10);
    c.lineTo(x - dir * 7, y + 10);
    c.fill();
  }
  function selectScreen(c, now) {
    const m = CREW[focus],
      p = reduce ? 1 : ease(Math.min(1, (now - cardAt) / 420)),
      box = frame(),
      shake = m.locked && now - denied < 320 ? Math.round(Math.sin((now - denied) / 26) * 3) : 0,
      sheet = { x: box.left + shake, y: 78, w: 132, h: 124 };
    fringe(c, m.name, box.left + 2 + shake, 40, font(26, 700, true), m.locked ? DIM : CREAM, "left", 0.4);
    put(c, m.role, box.left + 2 + shake, 60, font(9, 700), YELLOW, "left", 1.2);
    panel(c, sheet.x, sheet.y, sheet.w, sheet.h);
    if (m.locked) {
      put(c, "LOCKED", sheet.x + sheet.w / 2, sheet.y + 46, font(16, 700, true), YELLOW, "center", 1.5);
      c.font = font(10, 500);
      if ("letterSpacing" in c) c.letterSpacing = "0px";
      wrap(c, COPY.lockedLine, sheet.w - 18).forEach((line, i, all) =>
        put(c, line, sheet.x + sheet.w / 2, sheet.y + 74 + (i - (all.length - 1) / 2) * 13, font(10, 500), CREAM, "center", 0.4),
      );
    }
    if (!m.locked) m.skills.forEach(([label, value], i) => {
      const sy = sheet.y + 16 + i * 27,
        full = sheet.w - 20,
        n = Math.round(value * p),
        fill = Math.max(n ? 3 : 0, (full * n) / 100);
      put(c, label, sheet.x + 10, sy, font(10, 500), CREAM, "left", 0.3);
      put(c, String(n), sheet.x + sheet.w - 10, sy, font(10, 700), CREAM, "right");
      round(c, sheet.x + 10, sy + 7, full, 5, 2.5);
      c.fillStyle = "rgba(255,255,255,.12)";
      c.fill();
      if (fill) {
        round(c, sheet.x + 10, sy + 7, fill, 5, 2.5);
        c.fillStyle = shade(c, sheet.x + 10, 0, sheet.x + 10 + full, 0, RED, ORANGE);
        c.fill();
      }
    });
    c.font = font(13, 500, true);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
    const lines = wrap(c, `"${m.tagline}"`, 120).slice(0, 3),
      quoteTop = 158 - ((lines.length - 1) * 16) / 2;
    put(c, "TRIGGER", box.right, quoteTop - 16, font(8, 700), YELLOW, "right", 1.6);
    lines.forEach((line, i) => put(c, line, box.right, quoteTop + i * 16, font(13, 500, true), GREEN, "right"));
    /* tips land on the same x as the card and the quote */
    tri(c, box.left + 9, box.y, -1);
    tri(c, box.right - 9, box.y, 1);
    hints(c, box.y);
  }
  function chosenScreen(c, el) {
    if (!reduce && el < 0.25) {
      c.fillStyle = `rgba(255,255,255,${0.7 * (1 - el / 0.25)})`;
      c.fillRect(0, 0, W, H);
    }
    /* the camera centres the pick, so the words sit either side of it */
    if (el < 0.2) return;
    fringe(c, CREW[picked].name, frame().right, 150, font(36, 700, true), CREAM, "right", 1);
    if (reduce || Math.floor(el * 6) % 2 === 0) fringe(c, COPY.ready, frame().left, 150, font(30, 700, true), YELLOW, "left", 1);
  }
  const choiceAt = (i) => {
    const b = talkBox(),
      col = (b.w - 24) / 2;
    return [b.x + 14 + (i % 2) * col, b.y + 48 + Math.floor(i / 2) * 22, col];
  };
  function talkScreen(c, now, dt) {
    const m = CREW[picked],
      b = talkBox(),
      edge = frame();
    fringe(c, m.name, edge.right, 40, font(28, 700, true), CREAM, "right", 1);
    lift(c, m.role, edge.right, 60, font(9.5, 700), YELLOW, "right", 2);
    panel(c, b.x, b.y, b.w, b.h);
    pill(c, m.name, b.x + 12, b.y, font(10, 700), true, "left");

    if (talk.menu) {
      put(c, COPY.prompt, b.x + 16, b.y + 24, font(14, 500), DIM);
      COPY.menu.forEach(([, label], i) => {
        const [x, y, col] = choiceAt(i),
          on = i === talk.sel;
        if (on) {
          round(c, x - 6, y - 10, col - 8, 20, 4);
          c.fillStyle = shade(c, x - 6, 0, x + col - 14, 0, "rgba(242,181,26,.3)", "rgba(242,181,26,.04)");
          c.fill();
          arrow(c, x + 2, y, 4, "right", YELLOW);
        }
        put(c, label, x + (on ? 12 : 0), y + 0.5, font(12, 700), on ? YELLOW : CREAM, "left", 0.4);
      });
      return;
    }
    const fnt = font(14.5, 500);
    if (!talk.pages) {
      c.font = fnt;
      if ("letterSpacing" in c) c.letterSpacing = "0px";
      const lines = wrap(c, talk.text, b.w - 32);
      talk.pages = [];
      for (let i = 0; i < lines.length; i += 3) talk.pages.push(lines.slice(i, i + 3));
    }
    const lines = talk.pages[talk.page],
      total = pageLength();
    if (talk.shown < total) {
      const before = Math.floor(talk.shown / 3);
      talk.shown = reduce ? total : Math.min(total, talk.shown + dt * TYPE_SPEED);
      if (!reduce && Math.floor(talk.shown / 3) !== before) sfx.tick();
    }
    let left = Math.floor(talk.shown);
    lines.forEach((line, i) => {
      if (left > 0) put(c, line.slice(0, left), b.x + 16, b.y + 26 + i * 20, fnt, CREAM);
      left -= line.length;
    });
    if (talk.shown >= total)
      arrow(c, b.x + b.w - 16, b.y + b.h - 14 + (reduce ? 0 : Math.round(Math.sin(now / 140) * 1.5)), 4, "down", YELLOW);
  }

  function draw(c, now) {
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0,
      el = (now - since) / 1000;
    last = now;
    if (state === "chosen" && el >= chosenFor) {
      say("intro");
      go("talk");
    }
    if (state === "loading") return loadingScreen(c, now);
    backdrop(c);
    if (state === "select") spotlight(c, focus, reduce ? 1 : ease(Math.min(1, (now - cardAt) / 350)), true);
    else if (state !== "title") spotlight(c, picked, 1, state === "chosen");
    if (stage) {
      stage.update(dt, { mode: state, focus, picked });
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(stage.canvas, 0, 0, W, H);
    }
    if (state === "title") titleScreen(c, now);
    else if (state === "select") selectScreen(c, now);
    else if (state === "chosen") chosenScreen(c, el);
    else talkScreen(c, now, dt);
  }

  /* game logic */
  function setFocus(i) {
    if (i === focus) return;
    focus = i;
    cardAt = Date.now();
    sfx.cursor();
  }
  function start() {
    sfx.confirm();
    cardAt = Date.now();
    go("select");
  }
  function pick() {
    if (CREW[focus].locked) {
      denied = Date.now();
      sfx.back();
      return;
    }
    picked = focus;
    sfx.confirm();
    chosenFor = Math.max(1.3, Math.min(stage ? stage.play(picked) : 0, 2.6));
    go("chosen");
  }
  function toSelect() {
    sfx.back();
    cardAt = Date.now();
    go("select");
  }
  function say(node) {
    const m = CREW[picked];
    talk = {
      node,
      text: m.talk[node].replaceAll("{email}", m.email),
      pages: null,
      page: 0,
      shown: 0,
      menu: false,
      sel: talk ? talk.sel : 0,
    };
  }
  const pageLength = () => talk.pages[talk.page].reduce((n, line) => n + line.length, 0);
  function mail() {
    const m = CREW[picked],
      fill = (s) => encodeURIComponent(s.replaceAll("{name}", m.name));
    const a = document.createElement("a");
    a.href = `mailto:${m.email}?subject=${fill(COPY.mailSubject)}&body=${fill(COPY.mailBody)}`;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
  }
  /* confirm while talking: finish the line, turn the page, then open the menu (or the mail) */
  function advance() {
    if (talk.menu) return choose(talk.sel);
    if (!talk.pages) return;
    if (talk.shown < pageLength()) {
      talk.shown = pageLength();
      return;
    }
    if (talk.page < talk.pages.length - 1) {
      talk.page++;
      talk.shown = 0;
      sfx.cursor();
      return;
    }
    if (talk.node === "work") {
      sfx.confirm();
      mail();
      say("mailed");
      return;
    }
    sfx.cursor();
    talk.menu = true;
  }
  function choose(i) {
    const [node] = COPY.menu[i];
    if (node === "back") return toSelect();
    sfx.confirm();
    talk.sel = i;
    say(node);
  }

  /* -1 or +1 when the pointer is on a paging triangle, otherwise 0 */
  const pageAt = (x, y) => {
    const t = frame();
    if (Math.abs(y - t.y) > 16) return 0;
    if (Math.abs(x - (t.left + 9)) < 18) return -1;
    if (Math.abs(x - (t.right - 9)) < 18) return 1;
    return 0;
  };
  /* the card on the left and the quote on the right are for reading */
  const onCopy = (x, y) => {
    const t = frame();
    return (x >= t.left - 4 && x <= t.left + 140 && y > 28 && y < 214) || (x >= t.right - 112 && x <= t.right + 4 && y > 120 && y < 196);
  };
  const choice = (x, y) =>
    COPY.menu.findIndex((_, i) => {
      const [cx, cy, col] = choiceAt(i);
      return x > cx - 8 && x < cx + col - 10 && Math.abs(y - cy) < 11;
    });

  /* type: "move" | "tap" | "leave"; x, y in the W x H space; kind: "mouse" | "touch" | "pen". Returns true over something clickable. */
  function pointer(type, x, y, kind) {
    if (type === "leave") return false;
    if (state === "title") {
      if (type === "tap") start();
      return true;
    }
    if (state === "select") {
      const dir = pageAt(x, y);
      if (dir) {
        if (type === "tap") setFocus((focus + dir + CREW.length) % CREW.length);
        return true;
      }
      if (onCopy(x, y)) return false;
      const onCharacter = x > 145 && x < 270 && y > 40 && y < 250;
      if (type === "tap" && onCharacter) pick();
      return onCharacter;
    }
    if (state === "talk") {
      if (!talk.menu) {
        if (type === "tap") advance();
        return true;
      }
      const i = choice(x, y);
      if (i < 0) return false;
      if (talk.sel !== i) {
        talk.sel = i;
        sfx.cursor();
      }
      if (type === "tap") choose(i);
      return true;
    }
    return false;
  }
  /* Returns true when the key was used, so the television leaves it alone. Up, down and the digits always stay with the TV. */
  function key(k) {
    const ok = k === "Enter" || k === " ",
      side = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0;
    if (state === "title") {
      if (ok) start();
      return ok;
    }
    if (state === "select") {
      if (side) {
        setFocus((focus + side + CREW.length) % CREW.length);
      } else if (ok) pick();
      else if (k === "Escape") {
        sfx.back();
        go("title");
      } else return false;
      return true;
    }
    if (state === "chosen") return ok || !!side;
    if (state === "talk") {
      if (k === "Escape") toSelect();
      else if (ok) advance();
      else if (side) {
        if (talk.menu) {
          talk.sel = (talk.sel + side + COPY.menu.length) % COPY.menu.length;
          sfx.cursor();
        }
      } else return false;
      return true;
    }
    return false;
  }

  function reset() {
    go(ready ? "title" : "loading");
    last = 0;
    talk = null;
    if (stage) stage.rest();
  }

  return {
    name: "PS2",
    scale,
    draw,
    enter() {
      reset();
      load();
    },
    leave: reset,
    key,
    pointer,
    dispose() {
      dead = true;
      if (stage) stage.dispose();
      stage = null;
    },
  };
}
