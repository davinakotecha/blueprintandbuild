/*
 * tier.js: decides how much the page may do. Three tiers, from most to least:
 *
 *   full    WebGL, a capable device, no reduced-motion setting. Everything runs.
 *   lite    Few CPU cores, little memory, Data Saver on, or the hero measured low frame rates.
 *           Fewer particles at pixel ratio 1, no glass blur, no custom cursor.
 *   static  No WebGL, or prefers-reduced-motion. Static artwork, fades only, instant page changes.
 *
 * The tier is decided synchronously when this module is imported and written to <html data-tier>.
 * It only ever drops (full to lite to static), never climbs back, so effects can rely on it.
 * ?tier=full|lite|static forces a tier for testing and previews; a forced tier is locked and
 * ignores frame-rate reports and media changes, so screenshots stay repeatable.
 *
 * Public API (docs/INTERFACES.md): getTier(), onTierChange(fn), reportFrameRate(fps).
 */

const ORDER = ['full', 'lite', 'static'];
const root = document.documentElement;
const listeners = new Set();

// Frame-rate check: judged over the first seconds of reports, a few reports at a time.
const WINDOW_MS = 8000; // how long after the first report a drop may still be decided
const MIN_REPORTS = 3; // reports needed before judging
const DROP_BELOW = { full: 24, lite: 12 }; // average fps under this drops one tier

let webglOk = null;
let locked = false;
let tier = 'full';
let windowStart = 0;
let samples = [];

/** True when a WebGL context can be created. The answer is cached. */
function hasWebGL() {
  if (webglOk !== null) return webglOk;
  webglOk = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      webglOk = true;
      const lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext(); // give the context back at once
    }
  } catch {
    webglOk = false;
  }
  return webglOk;
}

function readOverride() {
  try {
    const wanted = new URLSearchParams(location.search).get('tier');
    return ORDER.includes(wanted) ? wanted : null;
  } catch {
    return null;
  }
}

const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

function isConstrained() {
  const cores = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;
  return Boolean((cores && cores <= 2) || (memory && memory <= 2) || (connection && connection.saveData));
}

function detect() {
  const forced = readOverride();
  if (forced) {
    locked = true;
    return forced;
  }
  if (motionQuery && motionQuery.matches) return 'static';
  if (!hasWebGL()) return 'static';
  return isConstrained() ? 'lite' : 'full';
}

/** Move to `next` only if it is lower than the current tier. */
function dropTo(next) {
  if (locked || ORDER.indexOf(next) <= ORDER.indexOf(tier)) return;
  tier = next;
  root.dataset.tier = tier;
  windowStart = 0;
  samples = [];
  listeners.forEach((fn) => {
    try {
      fn(tier);
    } catch {
      /* a broken listener must not stop the others */
    }
  });
}

tier = detect();
root.dataset.tier = tier;

// Reduced motion switched on while the page is open: go static. Data Saver switched on: go lite.
if (motionQuery) {
  const onMotion = (event) => {
    if (event.matches) dropTo('static');
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);
}
if (connection && connection.addEventListener) {
  connection.addEventListener('change', () => {
    if (connection.saveData) dropTo('lite');
  });
}

/** The current tier: 'full', 'lite' or 'static'. */
export function getTier() {
  return tier;
}

/**
 * Call fn(tier) whenever the tier drops later. Returns a function that removes the listener.
 * It is not called for the starting tier; read getTier() for that.
 */
export function onTierChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The hero reports its measured frames per second (about twice a second while it runs). Over the first
 * seconds, if the average of the latest reports is low, the tier drops one step. After the window closes
 * later reports are ignored, so a one-off hiccup cannot strip the page.
 */
export function reportFrameRate(fps) {
  if (locked || tier === 'static' || !Number.isFinite(fps) || fps <= 0) return;
  const now = performance.now();
  if (!windowStart) windowStart = now;
  if (now - windowStart > WINDOW_MS) return;
  samples.push(fps);
  if (samples.length < MIN_REPORTS) return;
  const recent = samples.slice(-MIN_REPORTS);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  if (average < DROP_BELOW[tier]) dropTo(ORDER[ORDER.indexOf(tier) + 1]);
}
