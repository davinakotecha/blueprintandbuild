/*
 * switch-owen.js: the neon glitch used when switching TO Owen (about 0.6s).
 *
 * The screen is torn into horizontal slices of Owen's midnight background that cut in at staggered times,
 * each with pink and cyan edges. The Full tier adds ghost blocks that shimmy sideways in hard steps (the RGB
 * split). Scanlines and a cyan tracking line run over the top. When every slice is in, apply() runs; then the
 * slices cut away again and the neon page is underneath.
 *
 * Flash safety (WCAG 2.3.1, at most 3 a second): the screen goes dark once (waves at 60ms and 150ms) and the
 * slices leave onto a page that is dark too (360ms and 480ms), so there is one real change in light level and
 * nothing white or large and bright is drawn. The Lite tier drops the ghost blocks and the cyan edge, so it
 * has no RGB split.
 *
 * Contract: export async function play({ from, to, origin, tier, apply }). apply() is called exactly once.
 * Reduced motion or the static tier: a short fade (data-motion="fade"). The overlay is aria-hidden,
 * pointer-events none, and removed at the end. Styles: css/switch.css. Tune the constants below.
 *
 * ?frames=1 (honoured on 127.0.0.1 and localhost only) pauses the animation and sets
 * window.__bbSwitch = { duration, seek(ms), finish() }. seek(ms) shows the frame at ms (apply() runs the first
 * time ms reaches APPLY_AT, so seek forward); finish() removes the overlay and resolves play(). Previews use it
 * to capture stills at 0, 150, 300 and 600ms.
 */

const DURATION = 600;
const APPLY_AT = 270; // every slice is in from 150ms and none leaves before 360ms
const WAVES = { a: [60, 480], b: [150, 360] }; // [cut in, cut away] in ms
const BANDS = [8, 14, 6, 12, 10, 16, 9, 13, 12]; // slice heights in % of the screen; they add up to 100
const FRAMES = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('frames') === '1'; // previews only
const HOLD = 'steps(1, end)'; // hard cuts between keyframes, no tweening

const reduced = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const at = (ms) => Math.min(1, ms / DURATION);

/** Small seeded random numbers, so the glitch looks the same every time (and in previews). */
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

/** Builds every slice, ghost block, the scanlines and the tracking line. Returns the animations. */
function build(overlay, lite) {
  const rand = rng(0x0e17);
  const anims = [];
  const add = (node, frames, options = {}) => anims.push(node.animate(frames, { duration: DURATION, fill: 'both', ...options }));
  let top = 0;
  BANDS.forEach((height, i) => {
    const [on, off] = WAVES[i % 2 ? 'b' : 'a'];
    const slice = make('bb-sw__slice', overlay);
    slice.style.top = `${top}%`;
    slice.style.height = `${height + 0.3}%`; // a hair of overlap so no gap shows between slices
    top += height;
    add(slice, [
      { opacity: 0, offset: 0, easing: HOLD },
      { opacity: 1, offset: at(on), easing: HOLD },
      { opacity: 0, offset: at(off) },
      { opacity: 0, offset: 1 },
    ]);
    if (lite) return;
    ['pink', 'cyan'].forEach((colour, k) => {
      const ghost = make(`bb-sw__ghost bb-sw__ghost--${colour}`, slice);
      const width = 18 + rand() * 30;
      ghost.style.left = `${rand() * (96 - width)}%`;
      ghost.style.top = `${(8 + rand() * 30).toFixed(0)}%`;
      ghost.style.height = `${(18 + rand() * 40).toFixed(0)}%`;
      ghost.style.width = `${width}%`;
      const reach = (k ? -1 : 1) * (14 + rand() * 26);
      const x = () => `translateX(${((rand() - 0.2) * reach).toFixed(1)}px)`;
      const span = at(off) - at(on);
      add(ghost, [
        { transform: x(), offset: 0, easing: HOLD },
        { transform: x(), offset: at(on) + span * 0.3, easing: HOLD },
        { transform: x(), offset: at(on) + span * 0.6, easing: HOLD },
        { transform: x(), offset: at(on) + span * 0.85 },
        { transform: 'none', offset: 1 },
      ]);
    });
  });
  const scan = make('bb-sw__scanlines', overlay);
  add(scan, [
    { opacity: 0, offset: 0 },
    { opacity: 0.55, offset: 0.25 },
    { opacity: 0.55, offset: 0.75 },
    { opacity: 0, offset: 1 },
  ]);
  if (!lite) {
    const line = make('bb-sw__line', overlay);
    const drop = `translateY(${window.innerHeight}px)`;
    add(line, [
      { transform: 'translateY(-4px)', opacity: 0.9, offset: 0 },
      { transform: drop, opacity: 0.9, offset: 0.85 },
      { transform: drop, opacity: 0, offset: 1 },
    ], { easing: 'linear' });
  }
  return anims;
}

export async function play({ to, tier, apply }) {
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

  const overlay = document.createElement('div');
  overlay.className = `bb-sw bb-sw--owen${tier === 'lite' ? ' bb-sw--lite' : ''}`;
  overlay.dataset.mode = to;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);

  const clock = overlay.animate([], { duration: APPLY_AT }); // fires when the new palette should appear
  const last = overlay.animate([], { duration: DURATION });
  const all = [clock, last, ...build(overlay, tier === 'lite')];

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
        seek(ms) {
          const t = Math.max(0, Math.min(DURATION, Number(ms) || 0));
          all.forEach((a) => {
            a.currentTime = t;
          });
          if (t >= APPLY_AT) applyOnce();
          return t;
        },
        finish: end,
      };
      return;
    }
    clock.finished.then(applyOnce, () => {});
    last.finished.then(end, end);
    setTimeout(end, DURATION + 800); // a hidden tab may not run animations; never leave an overlay behind
  });
}
