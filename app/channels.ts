import { readdirSync } from 'node:fs';
import path from 'node:path';

export type VideoChannel = { name: string; src: string };

const DIR = path.join(process.cwd(), 'public', 'tv');
const ABOUT_DIR = path.join(process.cwd(), 'public', 'about');
const VIDEO = /\.(mp4|webm|m4v)$/i;

/**
 * Character models found in /public/about, e.g. ["p1.glb", "p2.glb"].
 * The ABOUT channel shows a block mannequin for any character whose file is missing.
 */
export function aboutModels(): string[] {
  try {
    return readdirSync(ABOUT_DIR).filter((f) => /\.glb$/i.test(f) && !f.startsWith('.'));
  } catch {
    return [];
  }
}

/**
 * One channel per video in /public/tv, sorted by file name.
 * "01-garpez-tv.mp4" becomes CH 01 named "GARPEZ TV"; the numeric prefix only sets the order.
 */
export function videoChannels(): VideoChannel[] {
  let files: string[];
  try {
    files = readdirSync(DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => VIDEO.test(f) && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => ({
      name: f
        .replace(VIDEO, '')
        .replace(/^\d+[\s._-]*/, '')
        .replace(/[\s._-]+/g, ' ')
        .trim()
        .toUpperCase() || 'CHANNEL',
      src: `/tv/${encodeURIComponent(f)}`,
    }));
}
