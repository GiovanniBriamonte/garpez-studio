/*
 * Hand-off between the page that leaves and the page that arrives.
 * The landing sets `arrival = 'dive'` before navigating; /tv reads it on mount
 * and waits for `reveal` (fired by the Shell when the glitch starts clearing)
 * to play its zoom-out.
 */

let arrival = null;
/* set when leaving home for /tv; the set reads it once it has actually started */
let tvOn = false;
const listeners = new Set();

export function setArrival(kind) {
  arrival = kind;
}

/** Home → /tv should open with the set already on channel 1. */
export function armTvOn() {
  tvOn = true;
}

export function peekTvOn() {
  return tvOn;
}

export function clearTvOn() {
  tvOn = false;
}

/** Returns the pending arrival kind once, then clears it. */
export function takeArrival() {
  const a = arrival;
  arrival = null;
  return a;
}

export function onReveal(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reveal(ms) {
  for (const fn of [...listeners]) fn(ms);
}
