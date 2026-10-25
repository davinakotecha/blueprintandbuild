/*
 * scene-404.js (creative-dev): the 404 scene. A module script at the end of 404.html; it is both the loader and the scene.
 *
 * Particles in the mode's colours (--dot, --dot2, --dot3) start scattered and fly in on curved paths to spell the
 * page's own headline ("This MVP hasn't been built yet", read from the h1 so the words are never copied), laid out
 * in whichever line breaks make the words largest in the stage. Idle they drift; the pointer, read on the document
 * because the canvas takes no pointer events, nudges them aside with a little swirl and shifts the whole field.
 *
 * Tiers: static (reduced motion, no WebGL, ?tier=static) does nothing and the CSS-only version in scene-404.css stays.
 * Full: about 3000 particles at pixel ratio up to 2. Lite: about 1100 at ratio 1. A drop to lite rebuilds smaller,
 * a drop to static removes the canvas. fps is reported to tier.js after a warm-up, like the hero.
 *
 * Loading: nothing happens until the page has loaded and the browser is idle, then three.js (site/vendor/) is
 * imported on demand, so the 404 text paints first and the 700 KB of three never delays it. The scene pauses
 * when it is off screen or the tab is hidden, resizes with its box, and dispose() frees the GPU.
 * The canvas is aria-hidden and pointer-events none. If anything fails the canvas goes and the CSS version remains.
 */
import { getTier, onTierChange, reportFrameRate } from './tier.js';

const scene = document.querySelector('[data-scene-404]');
const COUNTS = { full: 3000, lite: 1100 };
const PIXEL_RATIO = { full: 2, lite: 1 };
const WARM_UP = 1200; // ms after (re)starting before frame rates count

const VERT = `
uniform float uTime, uAssemble, uSize, uPR, uPointerOn;
uniform vec2 uPointer, uParallax;
uniform vec3 uC0, uC1, uC2;
attribute vec2 aHome, aScatter;
attribute vec4 aRand;
varying vec3 vCol;
varying float vAlpha;
void main() {
  float p = clamp(uAssemble * 1.6 - aRand.x * 0.6, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 3.0);
  vec2 off = aScatter - aHome;
  vec2 pos = mix(aScatter, aHome, e) + vec2(-off.y, off.x) * 0.3 * sin(e * 3.14159);
  pos += mix(12.0, 1.6, e) * vec2(sin(uTime * 0.6 + aRand.w * 6.2831), cos(uTime * 0.5 + aRand.w * 9.0 + 1.3));
  pos += uParallax * (0.4 + aRand.z);
  vec2 d = pos - uPointer;
  float r = length(d) + 0.001;
  float push = (1.0 - smoothstep(0.0, 110.0, r)) * uPointerOn;
  pos += d / r * push * push * 22.0 + vec2(-d.y, d.x) / r * push * 7.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
  gl_PointSize = uSize * uPR * (0.7 + aRand.z * 0.9) * (1.0 + push * 0.6);
  vCol = aRand.y < 0.6 ? uC0 : (aRand.y < 0.88 ? uC1 : uC2);
  vAlpha = (0.45 + 0.55 * e) * (0.65 + 0.35 * aRand.z);
}`;

const FRAG = `
uniform float uGlow;
varying vec3 vCol;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.55, 1.0, d);
  if (a < 0.01) discard;
  float core = 1.0 - smoothstep(0.0, 0.5, d);
  a *= vAlpha;
  gl_FragColor = vec4(vCol * (1.0 + 0.5 * core * uGlow) * a, a * (1.0 - 0.45 * uGlow));
}`;

/** Small seeded random numbers, so the layout is the same on every load. */
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

const family = () => getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || '"IBM Plex Sans Variable", system-ui, sans-serif';

/** The headline words, split into lines so that the text fills the box best. Returns { lines, px } for a W by H box. */
function layoutWords(words, W, H) {
  const g = document.createElement('canvas').getContext('2d');
  const font = (px) => `600 ${px}px ${family()}`;
  g.font = font(100);
  let best = { px: 0, lines: [words.join(' ')] };
  for (let mask = 0; mask < 1 << (words.length - 1); mask += 1) { // every way to break between words
    const lines = [words[0]];
    for (let i = 1; i < words.length; i += 1) { if (mask & (1 << (i - 1))) lines.push(words[i]); else lines[lines.length - 1] += ` ${words[i]}`; }
    if (lines.length > 4) continue;
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    const px = Math.min((W * 0.96) / widest * 100, (H * 0.92) / (lines.length * 1.08));
    if (px > best.px) best = { px, lines };
  }
  return best;
}

/** The pixels of the laid-out text, as [x, y] pairs in CSS px relative to the scene box. */
function sampleText(lines, px, W, H) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W));
  c.height = Math.max(1, Math.ceil(H));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = `600 ${px}px ${family()}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const lh = px * 1.08;
  const top = (H - lh * lines.length) / 2 + px * 0.82;
  lines.forEach((line, i) => g.fillText(line, W / 2, top + i * lh));
  const img = g.getImageData(0, 0, c.width, c.height);
  const out = [];
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) if (img.data[(y * img.width + x) * 4 + 3] > 110) out.push([x, y]);
  return out;
}

async function mount(box, T) {
  const heading = document.querySelector('main h1');
  const phrase = ((heading && heading.textContent) || 'This MVP hasn’t been built yet').replace(/[.\s]+$/, '').trim();
  const words = phrase.split(/\s+/);
  if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load(`600 100px ${family()}`, phrase).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);

  let tier = getTier();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: tier === 'full' });
  const sc = new T.Scene();
  const camera = new T.OrthographicCamera(0, 1, 0, 1, -1, 1); // pixel units, y down
  const u = {
    uTime: { value: 0 }, uAssemble: { value: 0 }, uSize: { value: 2.6 }, uPR: { value: 1 }, uPointerOn: { value: 0 }, uGlow: { value: 1 },
    uPointer: { value: [-999, -999] }, uParallax: { value: [0, 0] },
    uC0: { value: new T.Color() }, uC1: { value: new T.Color() }, uC2: { value: new T.Color() },
  };
  const material = new T.ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
  });
  const probe = document.createElement('canvas').getContext('2d');
  const colour = (css) => { probe.fillStyle = 'gray'; probe.fillStyle = css; return new T.Color().setStyle(probe.fillStyle, T.LinearSRGBColorSpace); };
  const readPalette = () => {
    const s = getComputedStyle(document.documentElement);
    const bg = colour(s.getPropertyValue('--bg').trim());
    return { cols: ['--dot', '--dot2', '--dot3'].map((v) => colour(s.getPropertyValue(v).trim())), dark: bg.r * 0.3 + bg.g * 0.59 + bg.b * 0.11 < 0.4 };
  };
  const palette = readPalette();
  const paint = (snap) => {
    ['uC0', 'uC1', 'uC2'].forEach((k, i) => (snap ? u[k].value.copy(palette.cols[i]) : u[k].value.lerp(palette.cols[i], 0.12)));
    u.uGlow.value = palette.dark ? 1 : 0;
  };
  paint(true);

  let geometry = null, points = null, W = 1, H = 1, resizeTimer = 0, sized = false;
  let running = false, visible = true, disposed = false, raf = 0, last = 0, started = 0, quietUntil = 0, frames = 0, mark = 0;
  const ptr = { x: -999, y: -999, sx: -999, sy: -999, on: 0, goal: 0, parX: 0, parY: 0 };

  function layout() {
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    camera.right = W;
    camera.bottom = H;
    camera.updateProjectionMatrix();
    u.uPR.value = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[tier]);
    renderer.setPixelRatio(u.uPR.value);
    renderer.setSize(W, H, false);
  }

  /** (Re)builds the particles for the current box and tier: homes on the letters, scatter spots, random seeds. */
  function build() {
    const fit = layoutWords(words, W, H);
    const spots = sampleText(fit.lines, fit.px, W, H);
    const n = Math.round(COUNTS[tier] * Math.min(1, Math.max(0.5, (W * H) / 260000)));
    const rand = rng(0x404 + words.length);
    const home = new Float32Array(n * 2), scatter = new Float32Array(n * 2), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i += 1) {
      const s = spots.length ? spots[Math.floor(rand() * spots.length)] : [W / 2, H / 2];
      home[i * 2] = s[0] + rand() - 0.5;
      home[i * 2 + 1] = s[1] + rand() - 0.5;
      scatter[i * 2] = rand() * W * 1.2 - W * 0.1;
      scatter[i * 2 + 1] = rand() * H * 1.2 - H * 0.1;
      seed.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const next = new T.BufferGeometry();
    next.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(n * 3), 3)); // unused; gives three the count
    next.setAttribute('aHome', new T.Float32BufferAttribute(home, 2));
    next.setAttribute('aScatter', new T.Float32BufferAttribute(scatter, 2));
    next.setAttribute('aRand', new T.Float32BufferAttribute(seed, 4));
    if (points) points.geometry = next;
    else { points = new T.Points(next, material); points.frustumCulled = false; sc.add(points); }
    if (geometry) geometry.dispose();
    geometry = next;
    u.uSize.value = Math.max(1.7, Math.min(2.8, fit.px / 26));
    box.dataset.particles = String(n);
  }

  function frame(now) {
    raf = 0;
    if (!running || disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const ease = (rate) => Math.min(1, dt * rate);
    u.uTime.value += dt;
    u.uAssemble.value = Math.min(1, Math.max(0, (now - started - 300) / 2600));
    ptr.on += (ptr.goal - ptr.on) * ease(6);
    ptr.sx += (ptr.x - ptr.sx) * ease(12);
    ptr.sy += (ptr.y - ptr.sy) * ease(12);
    ptr.parX += ((ptr.goal ? (ptr.x / W - 0.5) * -14 : 0) - ptr.parX) * ease(3);
    ptr.parY += ((ptr.goal ? (ptr.y / H - 0.5) * -10 : 0) - ptr.parY) * ease(3);
    u.uPointer.value = [ptr.sx, ptr.sy];
    u.uParallax.value = [ptr.parX, ptr.parY];
    u.uPointerOn.value = ptr.on;
    paint(false);
    renderer.render(sc, camera);
    if (box.dataset.state !== 'live') box.dataset.state = 'live';
    frames += 1;
    if (now - mark >= 500) {
      const fps = (frames * 1000) / (now - mark);
      box.dataset.fps = fps.toFixed(1);
      if (now > quietUntil) reportFrameRate(fps);
      frames = 0;
      mark = now;
    }
    raf = requestAnimationFrame(frame);
  }

  function update() {
    const should = visible && !document.hidden && !disposed;
    if (should === running) return;
    running = should;
    if (running) {
      last = mark = performance.now();
      frames = 0;
      quietUntil = last + WARM_UP;
      if (!started) started = last;
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  // Mouse and pen only, read on the document (the canvas takes no pointer events). Touch has no hover.
  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    const r = box.getBoundingClientRect();
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    ptr.goal = 1;
  };
  const onLeave = () => { ptr.goal = 0; };
  const onMode = () => Object.assign(palette, readPalette());
  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('bb:modechange', onMode);
  document.addEventListener('visibilitychange', update);
  const intersect = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; update(); });
  intersect.observe(box);
  const resize = new ResizeObserver(() => {
    if (!sized) { sized = true; return; } // the first callback only reports the size already in use
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!disposed) { layout(); build(); } }, 150);
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    resize.disconnect();
    intersect.disconnect();
    stopTier();
    document.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('bb:modechange', onMode);
    document.removeEventListener('visibilitychange', update);
    if (geometry) geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    ['data-state', 'data-fps', 'data-particles'].forEach((name) => box.removeAttribute(name));
  }

  const stopTier = onTierChange((next) => {
    if (next === 'static') { dispose(); return; }
    tier = next;
    layout();
    build();
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); });

  layout();
  build();
  box.append(canvas);
  resize.observe(box);
  update();
  return { dispose };
}

/* ------------------------------------------------------------------ loader */
let handle = null;
let cancelled = false;

function fallBack() {
  if (handle) handle.dispose();
  handle = null;
  if (!scene) return;
  scene.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
  ['data-state', 'data-fps', 'data-particles'].forEach((name) => scene.removeAttribute(name));
}

async function start() {
  if (cancelled || !scene || getTier() === 'static') return;
  try {
    const three = await import('../vendor/three/three.module.js');
    if (cancelled || getTier() === 'static') return;
    handle = await mount(scene, three);
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

if (scene && getTier() !== 'static') {
  onTierChange((tier) => {
    if (tier !== 'static') return;
    cancelled = true;
    fallBack();
  });
  whenIdle(start);
}
