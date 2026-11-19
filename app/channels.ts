import { readdirSync } from 'node:fs';
import path from 'node:path';

export type VideoChannel = { name: string; src: string };

const DIR = path.join(process.cwd(), 'public', 'tv');
const VIDEO = /\.(mp4|webm|m4v)$/i;

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
