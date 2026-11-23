/* Synthesised sounds. Swap the methods on `sfx` for real samples later. */

export function createAudio(isMuted) {
  const timers = { amb: 0 };
  let ac, master, noiseBuf, amb = null;

  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = isMuted() ? 0 : 1; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  function env(g, t, peak, dur, attack = .004) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f0, f1, dur, peak, t = ac.currentTime) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, peak, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, peak, type, freq, q = 1, t = ac.currentTime, hard = false) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (hard) { g.gain.setValueAtTime(peak, t); g.gain.setValueAtTime(peak, t + dur - .012); g.gain.linearRampToValueAtTime(0, t + dur); }
    else env(g, t, peak, dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function setAmbience(kind) {
    clearTimeout(timers.amb);
    if (amb) { try { amb.g.gain.setTargetAtTime(0, ac.currentTime, .01); amb.s.stop(ac.currentTime + .08); } catch (e) {} amb = null; }
    if (!kind || !audio()) return;
    const g = ac.createGain(); let s;
    if (kind === 'tone') { s = ac.createOscillator(); s.frequency.value = 1000; g.gain.value = .018; s.connect(g); }
    else { s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 700; g.gain.value = .045; s.connect(f).connect(g); }
    g.connect(master); s.start(); amb = { s, g };
  }
  const sfx = {
    click() { if (!audio()) return; noise(.03, .5, 'bandpass', 2600, 1.2); tone('sine', 170, 60, .07, .5); },
    static(ms) { if (!audio()) return; noise(ms / 1000, .16, 'highpass', 700, .7, ac.currentTime + .02, true); },
    on() {
      if (!audio()) return; const t = ac.currentTime;
      noise(.035, .6, 'bandpass', 1800, 1); tone('sine', 140, 45, .12, .7);
      tone('sawtooth', 52, 48, .75, .11, t + .03);
      tone('sine', 6000, 11800, .9, .02, t + .05);
      noise(.45, .09, 'highpass', 5200, .7, t + .08);
    },
    off() {
      if (!audio()) return; const t = ac.currentTime;
      noise(.03, .6, 'bandpass', 2200, 1); tone('sine', 120, 40, .16, .6);
      tone('sine', 11000, 2400, .4, .022, t + .02);
    },
    /* game sounds for the ABOUT channel */
    cursor() { if (!audio()) return; tone('square', 660, 880, .05, .05); },
    confirm() {
      if (!audio()) return; const t = ac.currentTime;
      tone('square', 660, 660, .07, .06, t); tone('square', 990, 990, .07, .06, t + .07); tone('square', 1320, 1320, .18, .06, t + .14);
    },
    back() { if (!audio()) return; const t = ac.currentTime; tone('square', 520, 390, .08, .05, t); tone('square', 390, 260, .12, .05, t + .07); },
    tick() { if (!audio()) return; tone('square', 1400, 1400, .02, .02); },
    /* the commercial channel: a short ident, then a blip when the price lands */
    sting() {
      if (!audio()) return;
      const t = ac.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('square', f, f, .11, .04, t + i * .075));
    },
    coin() {
      if (!audio()) return;
      const t = ac.currentTime;
      tone('square', 1318.5, 1568, .06, .03, t);
      tone('square', 1975.5, 2093, .1, .028, t + .06);
    },
  };

  return {
    sfx,
    setAmbience,
    timers,
    get ac() { return ac; },
    get master() { return master; },
    close() { if (ac && ac.state !== 'closed') ac.close().catch(() => {}); },
  };
}
