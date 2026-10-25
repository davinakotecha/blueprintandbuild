/*
 * switch-standard.js: the calm circular reveal used when switching TO Standard (about 0.4s).
 *
 * The overlay carries data-mode="<to>" and a background of var(--bg), so it shows the palette we are switching
 * to. Its clip-path circle grows from the toggle until it covers the screen (0 to 280ms, IBM productive
 * easing), apply() runs at that moment, then the overlay fades away (280 to 400ms) to show the new page.
 *
 * Contract: export async function play({ from, to, origin, tier, apply }). apply() is called exactly once.
 * Reduced motion or the static tier: instant swap. The overlay is aria-hidden, pointer-events none, and
 * removed at the end. Styles are in css/switch.css. Tune COVER and DURATION below.
 *
 * ?frames=1 (honoured on 127.0.0.1 and localhost only) pauses the animation and sets
 * window.__bbSwitch = { duration, seek(ms), finish() }. seek(ms) shows the frame at ms (apply() runs the first
 * time ms reaches COVER, so seek forward); finish() removes the overlay and resolves play(). Previews use it
 * to capture stills.
 */

const COVER = 280;
const DURATION = 400;
const FRAMES = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('frames') === '1'; // previews only

const readVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const reduced = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export async function play({ to, origin, tier, apply }) {
  let applied = false;
  const applyOnce = () => {
    if (!applied) {
      applied = true;
      apply();
    }
  };
  if (reduced() || tier === 'static' || !document.body || !Element.prototype.animate) {
    applyOnce();
    return;
  }

  if (document.querySelector('.bb-sw')) {
    applyOnce(); // another switch is still playing; never stack overlays
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = origin && Number.isFinite(origin.x) ? origin.x : w - 40;
  const y = origin && Number.isFinite(origin.y) ? origin.y : 32;
  const radius = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 2;
  const ease = readVar('--ease-productive', 'ease-in-out');

  const overlay = document.createElement('div');
  overlay.className = 'bb-sw bb-sw--standard';
  overlay.dataset.mode = to;
  overlay.setAttribute('aria-hidden', 'true');
  const rim = document.createElement('div'); // a thin accent edge just ahead of the fill
  rim.className = 'bb-sw__rim';
  const fill = document.createElement('div');
  fill.className = 'bb-sw__fill';
  overlay.append(rim, fill);
  document.body.append(overlay);

  const opts = { duration: COVER, easing: ease, fill: 'both' };
  const clip = (r) => `circle(${r}px at ${x}px ${y}px)`;
  const anims = [
    fill.animate([{ clipPath: clip(0) }, { clipPath: clip(radius) }], opts),
    rim.animate([{ clipPath: clip(0) }, { clipPath: clip(radius + 6) }], opts),
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION - COVER, delay: COVER, easing: ease, fill: 'both' }),
    overlay.animate([], { duration: COVER }), // the clock for apply()
  ];

  await new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      applyOnce();
      anims.forEach((a) => a.cancel());
      overlay.remove();
      if (FRAMES) delete window.__bbSwitch;
      resolve();
    };
    if (FRAMES) {
      anims.forEach((a) => a.pause());
      window.__bbSwitch = {
        duration: DURATION,
        seek(ms) {
          const t = Math.max(0, Math.min(DURATION, Number(ms) || 0));
          anims.forEach((a) => {
            a.currentTime = t;
          });
          if (t >= COVER) applyOnce();
          return t;
        },
        finish: end,
      };
      return;
    }
    anims[3].finished.then(applyOnce, () => {});
    anims[2].finished.then(end, end);
    setTimeout(end, DURATION + 800); // a hidden tab may not run animations; never leave an overlay behind
  });
}
