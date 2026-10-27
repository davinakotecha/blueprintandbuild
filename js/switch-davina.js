/*
 * switch-davina.js: "Botanical unfurl", used when switching TO Davina (about 1.1s).
 *
 *   0 to 540ms     A vine grows from the toggle across the screen. Each leaf unfurls the moment the vine reaches it, and
 *                  two short shoots branch off with a leaf of their own.
 *   120 to 700ms   A pale sage wash spreads out from the toggle (a circle on one eased curve) and covers the old page.
 *   APPLY_AT       The moment the wash first covers the whole viewport, worked out from the screen size (about 430 to
 *                  470ms). apply() runs here, unseen: the vine and leaves are still on screen, so the new page is
 *                  already underneath by the time anything clears.
 *   380 to 1100ms  Blush petals drift down and sway.
 *   FADE_AT to 1100  The whole overlay fades out together (ease-out), so the new page shows through the leaves and
 *                  petals and the screen is never a bare flat colour.
 *
 * Lite tier: fewer leaves, no shoots, no petals. Nothing flashes: the only large change in brightness is the single
 * spread from the old palette to a pale sage and then Davina's own blush.
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

const DURATION = 1100;
const VINE = [0, 540]; // when the vine starts growing and when it has reached the far side
const WASH = [120, 700]; // when the sage wash starts spreading and when it reaches its full size
const FADE_AT = 560; // when the overlay starts to fade out
const LEAF_MS = 280; // how long one leaf takes to unfurl
const LEAVES = { full: 12, lite: 6 };
const PETALS = { full: 16, lite: 0 };
const OVERSHOOT = 1.15; // the wash grows to this many times the distance to the far corner, so it covers the screen before it stops
const SVG_NS = 'http://www.w3.org/2000/svg';
const FRAMES = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('frames') === '1'; // previews only

const reduced = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const at = (ms) => Math.max(0, Math.min(1, ms / DURATION));

/** Small seeded random numbers, so the vine looks the same every time (and in previews). */
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

function make(cls, parent, tag = 'div') {
  const node = document.createElement(tag);
  node.className = cls;
  parent.append(node);
  return node;
}

function svg(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
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

/** A cubic-bezier easing as a function of progress, and its inverse (the progress at which the eased value reaches y). */
function bezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const ease = (x) => {
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
  const inverse = (y) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (ease(mid) < y) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  return { ease, inverse };
}

const EXPRESSIVE = bezier(0.4, 0.14, 0.3, 1); // IBM expressive, the same curve as --ease-expressive
const EXPRESSIVE_CSS = 'cubic-bezier(0.4, 0.14, 0.3, 1)';

/** The wash: how far it has to grow, and APPLY_AT (ms), the first moment it covers every corner of the screen. */
function washPlan(x, y, w, h) {
  const reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  const final = reach * OVERSHOOT;
  const applyAt = Math.ceil(WASH[0] + (WASH[1] - WASH[0]) * EXPRESSIVE.inverse(1 / OVERSHOOT));
  return { reach, final, applyAt };
}

/** The sage wash and the rim in front of it, both growing from the toggle. */
function wash(overlay, { x, y, plan }) {
  const rim = make('bb-sw__rim', overlay);
  const fill = make('bb-sw__wash', overlay);
  const circle = (r) => `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
  const grow = (node, extra) => node.animate([
    { clipPath: circle(0), offset: 0 },
    { clipPath: circle(0), offset: at(WASH[0]), easing: EXPRESSIVE_CSS },
    { clipPath: circle(plan.final + extra), offset: at(WASH[1]) },
    { clipPath: circle(plan.final + extra), offset: 1 },
  ], { duration: DURATION, fill: 'both', easing: 'linear' });
  return [grow(rim, 18), grow(fill, 0)];
}

/** A leaf pointing along +x with its stalk at the origin, `size` px long. */
const leafPath = (size) => `M0 0 C${size * 0.25} ${-size * 0.55} ${size * 0.75} ${-size * 0.55} ${size} 0 C${size * 0.75} ${size * 0.55} ${size * 0.25} ${size * 0.55} 0 0Z`;

/** The point and direction (in degrees) a fraction of the way along a path. */
function along(path, total, fraction) {
  const here = path.getPointAtLength(total * fraction);
  const ahead = path.getPointAtLength(Math.min(total, total * fraction + 2));
  return { x: here.x, y: here.y, deg: (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI };
}

/** The vine, its leaves and two shoots. Returns their animations. */
function grow(overlay, { x, y, w, h, rtl, lite }) {
  const rand = rng(0xb07a);
  const anims = [];
  const add = (node, frames, easing = 'linear') => anims.push(node.animate(frames, { duration: DURATION, fill: 'both', easing }));
  const sign = rtl ? -1 : 1;
  const px = (f) => x + sign * f * w;
  const py = (f) => Math.min(h * 0.94, y + f * h);
  const vine = svg('svg', { class: 'bb-sw__vine', viewBox: `0 0 ${w} ${h}`, width: w, height: h, focusable: 'false' }, overlay);
  const d = `M${x} ${y} C${px(0.2)} ${py(0.3)} ${px(0.4)} ${py(-0.02)} ${px(0.55)} ${py(0.38)} S${px(0.8)} ${py(0.62)} ${px(0.93)} ${py(0.8)}`;
  const halo = svg('path', { class: 'bb-sw__halo', d, pathLength: 1 }, vine);
  const stem = svg('path', { class: 'bb-sw__stem', d, pathLength: 1 }, vine);
  const total = stem.getTotalLength();

  // The path is drawn on one eased curve, so a leaf at fraction f appears when that curve reaches f.
  const reachAt = (fraction) => VINE[0] + (VINE[1] - VINE[0]) * EXPRESSIVE.inverse(fraction);
  const draw = (node, from, to, easing) => add(node, [
    { strokeDashoffset: 1, offset: 0 },
    { strokeDashoffset: 1, offset: at(from), easing },
    { strokeDashoffset: 0, offset: at(to) },
    { strokeDashoffset: 0, offset: 1 },
  ]);
  [halo, stem].forEach((node) => draw(node, VINE[0], VINE[1], EXPRESSIVE_CSS));

  const base = Math.max(24, Math.min(46, w * 0.034));
  const leaf = (point, side, size, shade, start) => {
    const g = svg('g', { class: `bb-sw__leaf bb-sw__leaf--${shade}` }, vine);
    svg('path', { d: leafPath(size) }, g);
    svg('path', { class: 'bb-sw__rib', d: `M0 0 L${size * 0.82} 0` }, g);
    const place = (turn, s) => `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) rotate(${(point.deg + side * 52 + turn).toFixed(1)}deg) scale(${s})`;
    add(g, [
      { transform: place(side * -48, 0), opacity: 0, offset: 0 },
      { transform: place(side * -48, 0), opacity: 0, offset: at(start) },
      { transform: place(side * 6, 1.14), opacity: 1, offset: at(start + LEAF_MS * 0.7) },
      { transform: place(0, 1), opacity: 1, offset: at(start + LEAF_MS) },
      { transform: place(0, 1), opacity: 1, offset: 1 },
    ], 'ease-out');
  };

  const count = lite ? LEAVES.lite : LEAVES.full;
  for (let i = 0; i < count; i += 1) {
    const fraction = (i + 1) / (count + 1);
    const side = i % 2 ? 1 : -1;
    leaf(along(stem, total, fraction), side, base * (0.8 + rand() * 0.6), i % 3 === 0 ? 'b' : 'a', reachAt(fraction));
  }

  if (!lite) {
    [0.34, 0.66].forEach((fraction, k) => {
      const root = along(stem, total, fraction);
      const side = k % 2 ? 1 : -1;
      const turn = ((root.deg + side * 70) * Math.PI) / 180;
      const length = w * 0.1;
      const tip = { x: root.x + Math.cos(turn) * length, y: root.y + Math.sin(turn) * length };
      const bend = { x: root.x + Math.cos(turn - side * 0.5) * length * 0.55, y: root.y + Math.sin(turn - side * 0.5) * length * 0.55 };
      const shoot = `M${root.x.toFixed(1)} ${root.y.toFixed(1)} Q${bend.x.toFixed(1)} ${bend.y.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`;
      const start = reachAt(fraction);
      [svg('path', { class: 'bb-sw__halo', d: shoot, pathLength: 1 }, vine), svg('path', { class: 'bb-sw__stem bb-sw__stem--shoot', d: shoot, pathLength: 1 }, vine)]
        .forEach((node) => draw(node, start, start + 200, 'ease-out'));
      const end = { x: tip.x, y: tip.y, deg: (Math.atan2(tip.y - bend.y, tip.x - bend.x) * 180) / Math.PI };
      leaf(end, side, base * 1.05, 'b', start + 150);
    });
  }
  return anims;
}

/** Blush petals that drift down and sway while the overlay clears. */
function petals(overlay, { w, h }) {
  const rand = rng(0x9e7a);
  const anims = [];
  const drops = make('bb-sw__petals', overlay);
  for (let i = 0; i < PETALS.full; i += 1) {
    const size = 9 + rand() * 9;
    const startX = rand() * w;
    const sway = (rand() - 0.5) * 120;
    const spin = (rand() > 0.5 ? 1 : -1) * (160 + rand() * 200);
    const start = 380 + Math.round(rand() * 260);
    const end = Math.min(DURATION, start + 520 + Math.round(rand() * 200));
    const petal = make('bb-sw__petal', drops);
    petal.style.width = `${size}px`;
    petal.style.height = `${size * 0.62}px`;
    const place = (fy, dx, turn) => `translate(${(startX + dx).toFixed(1)}px, ${(fy * h).toFixed(1)}px) rotate(${turn.toFixed(0)}deg)`;
    anims.push(petal.animate([
      { transform: place(-0.06, 0, 0), opacity: 0, offset: 0 },
      { transform: place(-0.06, 0, 0), opacity: 0, offset: at(start) },
      { transform: place(0.35, sway * 0.6, spin * 0.3), opacity: 1, offset: at(start + (end - start) * 0.25) },
      { transform: place(1.06, sway, spin), opacity: 1, offset: at(end) },
      { transform: place(1.06, sway, spin), opacity: 0, offset: 1 },
    ], { duration: DURATION, fill: 'both', easing: 'ease-in' }));
  }
  return anims;
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
  const rtl = x > w / 2; // the toggle is on the right, so the vine grows leftwards (otherwise the reverse)
  const lite = tier === 'lite';

  const overlay = document.createElement('div');
  overlay.className = `bb-sw bb-sw--davina${rtl ? ' bb-sw--rtl' : ''}${lite ? ' bb-sw--lite' : ''}`;
  overlay.dataset.mode = to;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);

  const plan = washPlan(x, y, w, h);
  const applyAt = plan.applyAt; // APPLY_AT: the wash covers the whole viewport from here
  const fadeOut = overlay.animate([
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: at(FADE_AT), easing: 'ease-out' },
    { opacity: 0, offset: 1 },
  ], { duration: DURATION, fill: 'both', easing: 'linear' });
  const clock = overlay.animate([], { duration: applyAt }); // fires when the new palette should appear
  const all = [
    fadeOut,
    clock,
    ...wash(overlay, { x, y, plan }),
    ...grow(overlay, { x, y, w, h, rtl, lite }),
    ...(lite ? [] : petals(overlay, { w, h })),
  ];

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
