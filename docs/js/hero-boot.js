/*
 * hero-boot.js: loads the WebGL hero after the page has painted. A module script at the end of <body> on Home.
 *
 * Static tier (no WebGL, reduced motion, ?tier=static): does nothing, and the CSS artwork from hero.css stays.
 * Full and lite tiers: waits for window load, then for the browser to be idle, then imports hero.js (which
 * brings in three.js) and mounts a canvas into [data-hero-art]. If anything fails, the canvas is removed and
 * the CSS artwork is all that is left. Nothing here blocks the first paint or the text.
 */
import { getTier, onTierChange } from './tier.js';

const art = document.querySelector('[data-hero-art]');
let handle = null;
let cancelled = false;

function fallBack() {
  if (handle) handle.dispose();
  handle = null;
  if (!art) return;
  art.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
  art.removeAttribute('data-state');
}

async function start() {
  if (cancelled || !art || getTier() === 'static') return;
  try {
    const { mount } = await import('./hero.js');
    if (cancelled || getTier() === 'static') return;
    handle = await mount(art);
    if (cancelled && handle) handle.dispose();
  } catch {
    fallBack();
  }
}

function whenIdle(fn) {
  const run = () => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

if (art && getTier() !== 'static') {
  onTierChange((tier) => {
    if (tier !== 'static') return;
    cancelled = true;
    fallBack();
  });
  whenIdle(start);
}
