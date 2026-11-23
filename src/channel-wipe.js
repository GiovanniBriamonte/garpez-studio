/*
 * Times the channel change. The tear itself is the CSS on body.is-channeling.
 * `onCovered` fires once the tear is underway, so the next page can arrive
 * underneath it.
 */

const DURATION = 420;

export function playChannelWipe(canvas, { onCovered } = {}) {
  let raf = 0;
  let stopped = false;
  const promise = new Promise((resolve) => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      onCovered?.();
      resolve();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(1, 720 / Math.max(rect.width, 1));
    const W = Math.max(2, Math.round(rect.width * scale));
    const H = Math.max(2, Math.round(rect.height * scale));
    canvas.width = W;
    canvas.height = H;

    const t0 = performance.now();
    let covered = false;

    const frame = (now) => {
      if (stopped) return;
      const e = now - t0;
      const p = Math.min(1, e / DURATION);
      ctx.clearRect(0, 0, W, H);

      if (!covered && e >= 130) {
        covered = true;
        onCovered?.();
      }
      if (p < 1) raf = requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, W, H);
        resolve();
      }
    };
    raf = requestAnimationFrame(frame);
  });
  promise.cancel = () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
  return promise;
}
