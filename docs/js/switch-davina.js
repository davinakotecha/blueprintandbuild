/*
 * switch-davina.js: the screen clean used when switching TO Davina (about 1s).
 *
 *   0 to 460ms     A spray bottle at the toggle: a puff, then droplets fly out across the screen, land with a
 *                  little splat and start to drip, while a fine mist fogs the old page.
 *   460 to 900ms   A cloth sweeps across, starting at the side the toggle is on and travelling to the other side.
 *                  Behind it the screen is clean: Davina's espresso, drawn by a layer that carries data-mode="davina".
 *   APPLY_AT       The moment the clean layer first covers the whole viewport, worked out from the screen width
 *                  (about 710ms at 390px wide, 755 at 1440, 785 at 2560). apply() runs here, unseen, with the cloth
 *                  still on screen; the new page is then already underneath.
 *   APPLY_AT to 1040  The whole overlay (cloth included) fades out at once, ease-out, so the new page shows
 *                  through from the first frame after apply() and the screen is never a bare flat colour.
 *
 * Lite tier: fewer droplets, no drips. Nothing flashes: the only large change in brightness is the single
 * sweep from the old palette to Davina's.
 *
 * Contract: export async function play({ from, to, origin, tier, apply }). apply() is called exactly once.
 * Reduced motion or the static tier: a short fade (data-motion="fade"). The overlay is aria-hidden,
 * pointer-events none, and removed at the end. Styles: css/switch.css. Tune the constants below.
 *
 * ?frames=1 (honoured on 127.0.0.1 and localhost only) pauses the animation and sets
 * window.__bbSwitch = { duration, applyAt, seek(ms), finish() }. seek(ms) shows the frame at ms (apply() runs
 * the first time ms reaches applyAt, so seek forward); finish() removes the overlay and resolves play().
 * Previews use it to capture stills.
 */

const DURATION = 1040;
const WIPE = [460, 900]; // when the cloth starts and when it reaches the far side of the screen
const DROPS = { full: 46, lite: 16 };
const FRAMES = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('frames') === '1'; // previews only

const readVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const reduced = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const at = (ms) => Math.min(1, ms / DURATION);

/** Small seeded random numbers, so the spray looks the same every time (and in previews). */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(cls, parent) {
  const node = document.createElement('div');
  node.className = cls;
  parent.append(node);
  return node;
}

/** Short fade for reduced motion and the static tier: the new background fades in, apply(), fades out. */
async function fade(to, apply) {
  const overlay = document.createElement('div');
  overlay.className = 'bb-sw bb-sw--fade';
  overlay.dataset.mode = to;
  overlay.dataset.motion = 'fade';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  await overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: 'both' }).finished.catch(() => {});
  apply();
  await overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'both' }).finished.catch(() => {});
  overlay.remove();
}

/** A cubic-bezier easing as a function, so the clean layer and the cloth are sampled from one curve. */
function bezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i += 1) {
      t = (lo + hi) / 2;
      if (X(t) < x) lo = t;
      else hi = t;
    }
    return Y(t);
  };
}

/** The cloth's path for a screen `w` wide: its edge at 17 steps along one eased curve, and APPLY_AT (ms), where the clean layer first covers the screen. */
function sweep(w) {
  const cw = Math.max(110, Math.min(220, w * 0.2));
  const ease = bezier(0.4, 0.14, 0.3, 1); // IBM expressive, the same curve as --ease-expressive
  const from = -cw / 2 - 48; // start (and end) clear of the screen so the cloth's shadow never shows early
  const to = w + cw / 2 + 48;
  const keys = Array.from({ length: 17 }, (_, i) => ({ p: i / 16, ms: WIPE[0] + ((WIPE[1] - WIPE[0]) * i) / 16, edge: from + (to - from) * ease(i / 16) }));
  // The clip is clamped to w at the first step whose edge reaches w, so that step is when the layer is fully covering.
  return { cw, from, to, keys, applyAt: Math.ceil(keys.find((key) => key.edge >= w).ms) };
}

/** The nozzle puff, the mist and the droplets. Returns their animations. */
function spray(overlay, { x, y, w, h, lite }) {
  const rand = rng(0xda71);
  const anims = [];
  const add = (node, frames, options = {}) => anims.push(node.animate(frames, { duration: DURATION, fill: 'both', ...options }));
  const ease = readVar('--ease-productive', 'ease-out');

  const mist = make('bb-sw__mist', overlay);
  mist.style.setProperty('--ox', `${x}px`);
  mist.style.setProperty('--oy', `${y}px`);
  add(mist, [{ opacity: 0, offset: 0 }, { opacity: 1, offset: at(420) }, { opacity: 1, offset: 1 }], { easing: ease });

  const puff = make('bb-sw__puff', overlay);
  puff.style.left = `${x}px`;
  puff.style.top = `${y}px`;
  add(puff, [
    { opacity: 0, transform: 'scale(0.3)', offset: 0 },
    { opacity: 0.9, transform: 'scale(1.1)', offset: at(110) },
    { opacity: 0, transform: 'scale(2.6)', offset: at(520) },
    { opacity: 0, transform: 'scale(2.6)', offset: 1 },
  ], { easing: ease });

  // Spray towards the middle of the screen, in a fan.
  const aim = Math.atan2(h / 2 - y, w / 2 - x);
  const reach = Math.max(w, h) * 0.75;
  const drops = make('bb-sw__drops', overlay);
  for (let i = 0; i < (lite ? DROPS.lite : DROPS.full); i += 1) {
    const size = 4 + rand() * 10;
    const angle = aim + (rand() - 0.5) * 1.5;
    const dist = (0.1 + Math.pow(rand(), 0.8) * 0.9) * reach;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const start = Math.round(rand() * 240); // when this droplet leaves the nozzle
    const land = start + 140 + Math.round(rand() * 80);
    const drip = lite ? 0 : rand() * 26;
    const drop = make('bb-sw__drop', drops);
    drop.style.width = `${size}px`;
    drop.style.height = `${size}px`;
    drop.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
    const home = `translate(${x}px, ${y}px) scale(0.2)`;
    const there = (s, extraY = 0) => `translate(${(x + dx).toFixed(1)}px, ${(y + dy + extraY).toFixed(1)}px) scale(${s})`;
    add(drop, [
      { opacity: 0, transform: home, offset: 0 },
      { opacity: 0, transform: home, offset: at(start) },
      { opacity: 1, transform: there(1.35), offset: at(land) },
      { opacity: 1, transform: there(1), offset: at(land + 70) },
      { opacity: 1, transform: there(1, drip), offset: at(WIPE[1]) },
      { opacity: 1, transform: there(1, drip), offset: 1 },
    ], { easing: ease });
  }
  return anims;
}

/** The clean layer and the cloth, both sampled from the sweep so the cloth rides the clean edge. */
function wipe(overlay, { w, rtl, path }) {
  const { cw, from, to, keys } = path;
  const clean = make('bb-sw__clean', overlay);
  const cloth = make('bb-sw__cloth', overlay);
  cloth.style.width = `${cw}px`;
  const inset = (covered) => (rtl ? `inset(0 0 0 ${(w - covered).toFixed(1)}px)` : `inset(0 ${(w - covered).toFixed(1)}px 0 0)`);
  const place = (edge, tilt) => `translateX(${(rtl ? w - edge - cw / 2 : edge - cw / 2).toFixed(1)}px) rotate(${tilt.toFixed(2)}deg)`;
  const cleanFrames = [{ clipPath: inset(0), offset: 0 }];
  const clothFrames = [{ transform: place(from, 0), offset: 0 }];
  keys.forEach(({ p, ms, edge }) => {
    cleanFrames.push({ clipPath: inset(Math.max(0, Math.min(w, edge))), offset: at(ms) });
    clothFrames.push({ transform: place(edge, Math.sin(p * Math.PI * 2) * -2.5 * (rtl ? -1 : 1)), offset: at(ms) });
  });
  cleanFrames.push({ clipPath: inset(w), offset: 1 });
  clothFrames.push({ transform: place(to, 0), offset: 1 });
  const options = { duration: DURATION, fill: 'both', easing: 'linear' };
  return [clean.animate(cleanFrames, options), cloth.animate(clothFrames, options)];
}

export async function play({ to, origin, tier, apply }) {
  let applied = false;
  const applyOnce = () => {
    if (!applied) {
      applied = true;
      apply();
    }
  };
  if (!document.body || !Element.prototype.animate) {
    applyOnce();
    return;
  }
  if (reduced() || tier === 'static') {
    await fade(to, applyOnce);
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
  const rtl = x > w / 2; // the toggle is on the right, so the cloth starts on the right and travels left (otherwise the reverse)
  const lite = tier === 'lite';

  const overlay = document.createElement('div');
  overlay.className = `bb-sw bb-sw--davina${rtl ? ' bb-sw--rtl' : ''}${lite ? ' bb-sw--lite' : ''}`;
  overlay.dataset.mode = to;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);

  const path = sweep(w);
  const applyAt = path.applyAt; // APPLY_AT: the clean layer covers the whole viewport from here
  const fadeOut = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: DURATION - applyAt,
    delay: applyAt,
    fill: 'both',
    easing: 'ease-out',
  });
  const clock = overlay.animate([], { duration: applyAt }); // fires when the new palette should appear
  const all = [fadeOut, clock, ...spray(overlay, { x, y, w, h, lite }), ...wipe(overlay, { w, rtl, path })];

  await new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      applyOnce();
      all.forEach((a) => a.cancel());
      overlay.remove();
      if (FRAMES) delete window.__bbSwitch;
      resolve();
    };
    if (FRAMES) {
      all.forEach((a) => a.pause());
      window.__bbSwitch = {
        duration: DURATION,
        applyAt,
        seek(ms) {
          const t = Math.max(0, Math.min(DURATION, Number(ms) || 0));
          all.forEach((a) => {
            a.currentTime = t;
          });
          if (t >= applyAt) applyOnce();
          return t;
        },
        finish: end,
      };
      return;
    }
    clock.finished.then(applyOnce, () => {});
    fadeOut.finished.then(end, end);
    setTimeout(end, DURATION + 800); // a hidden tab may not run animations; never leave an overlay behind
  });
}
