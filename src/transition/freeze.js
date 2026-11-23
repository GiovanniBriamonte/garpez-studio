/*
 * Freezes the page that is leaving: a static copy of header, frame and footer
 * laid over the viewport, so the next page can load underneath and be
 * revealed cell by cell. Canvases are copied as pixels (WebGL canvases need
 * `preserveDrawingBuffer: true`), videos become a still of their frame.
 */

/* header/footer are styled from body classes (tv-mode…), so pin their look */
const PIN = [
  'color',
  'background-color',
  'background-image',
  'border-color',
  'filter',
  'opacity',
  'transform',
];

function pinStyles(from, to) {
  const cs = getComputedStyle(from);
  for (const p of PIN) to.style.setProperty(p, cs.getPropertyValue(p));
  const a = from.children;
  const b = to.children;
  for (let i = 0; i < a.length && i < b.length; i++) pinStyles(a[i], b[i]);
}

function copyPixels(from, to) {
  const src = from.querySelectorAll('canvas');
  const dst = to.querySelectorAll('canvas');
  src.forEach((c, i) => {
    const d = dst[i];
    if (!d) return;
    d.width = c.width;
    d.height = c.height;
    try {
      d.getContext('2d')?.drawImage(c, 0, 0);
    } catch {
      /* tainted or lost context: leave it blank */
    }
  });
  const vSrc = from.querySelectorAll('video');
  const vDst = to.querySelectorAll('video');
  vSrc.forEach((v, i) => {
    const d = vDst[i];
    if (!d) return;
    const still = document.createElement('canvas');
    still.className = d.className;
    still.style.cssText = d.style.cssText;
    still.width = v.videoWidth || 1;
    still.height = v.videoHeight || 1;
    try {
      still.getContext('2d')?.drawImage(v, 0, 0);
    } catch {
      /* ignore */
    }
    d.replaceWith(still);
  });
}

/**
 * @returns {{ el: HTMLElement, clip: (d: string) => void, remove: () => void } | null}
 */
export function freezePage() {
  const header = document.querySelector('.site-header');
  const frame = document.querySelector('.site-frame');
  const footer = document.querySelector('.site-footer');
  if (!frame) return null;

  const ghost = document.createElement('div');
  ghost.className = 'page-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const body = getComputedStyle(document.body);
  ghost.style.backgroundColor = body.backgroundColor;
  ghost.style.backgroundImage = body.backgroundImage;

  for (const part of [frame, header, footer]) {
    if (!part) continue;
    const copy = /** @type {HTMLElement} */ (part.cloneNode(true));
    if (part !== frame) pinStyles(part, copy);
    copyPixels(part, copy);
    if (part === frame) {
      /* keep its box, drop the class so frame animations don't touch the copy */
      copy.className = 'page-ghost-frame';
    }
    /* ids stay: the TV styles hang on them. The copy lives ~1 s and every
       engine queries its own root, so the duplicates are harmless. */
    ghost.appendChild(copy);
  }

  document.body.appendChild(ghost);
  return {
    el: ghost,
    clip(d) {
      ghost.style.clipPath = d ? `path('${d}')` : 'inset(50%)';
    },
    remove() {
      ghost.remove();
    },
  };
}
