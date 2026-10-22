/*
 * hero.js: the Home hero's WebGL particles. Imported only by hero-boot.js, and the only file that imports three.js.
 *
 * Particles in the mode's colours (--dot, --dot2, --dot3) start scattered, then assemble into this cycle's
 * heroWord (data/cycle.json; "MVP" if missing), sampled from the word drawn in IBM Plex Sans Variable. They drift
 * when idle and are pushed gently away by the pointer. Positions are computed in the vertex shader, so a frame
 * is one draw call and a few uniforms.
 *
 * Where it sits: from 66rem the word is right of the text column (the measured right edge of the text sets
 * --hero-clear, which also masks the canvas). Below that it is a small, fainter word in the bottom band
 * (--hero-band, the hero's bottom padding), clear of the text.
 *
 * Cost: pixel ratio capped (full 2, lite 1); about 6000 particles (lite 1500, phones 40%, lite phones 70%); paused while the hero
 * is off screen or the tab is hidden; fps reported to tier.js after a warm-up (a drop to lite rebuilds with
 * fewer particles at ratio 1; static removes the canvas); resize via ResizeObserver; dispose() frees the GPU.
 *
 * export async function mount(artElement) returns { dispose }; it rejects if WebGL fails, and hero-boot.js then
 * leaves the CSS artwork. The canvas is aria-hidden and pointer-events none; the pointer is read on the hero.
 */
import {
  WebGLRenderer, Scene, OrthographicCamera, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Points,
  Color, LinearSRGBColorSpace, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor,
} from '../vendor/three/three.module.js';
import { getTier, onTierChange, reportFrameRate } from './tier.js';
import { getData } from './content.js';

const COUNTS = { full: 6000, lite: 1500 };
const PIXEL_RATIO = { full: 2, lite: 1 };
const WIDE = window.matchMedia('(min-width: 66rem)'); // the same breakpoint as hero.css
const WARM_UP = 1200; // ms after (re)starting before frame rates count

const VERT = `
uniform float uTime, uAssemble, uSize, uPR, uPointerOn, uAlpha;
uniform vec2 uPointer, uParallax;
uniform vec3 uC0, uC1, uC2;
attribute vec2 aHome, aScatter;
attribute vec4 aRand;
varying vec3 vCol;
varying float vAlpha;
void main() {
  float p = clamp(uAssemble * 1.5 - aRand.x * 0.5, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - p, 3.0);
  vec2 pos = mix(aScatter, aHome, e);
  pos += mix(14.0, 2.5, e) * vec2(sin(uTime * 0.6 + aRand.w * 6.2831), cos(uTime * 0.5 + aRand.w * 9.0 + 1.3));
  pos += uParallax * (0.4 + aRand.z);
  vec2 d = pos - uPointer;
  float r = length(d) + 0.001;
  float push = (1.0 - smoothstep(0.0, 100.0, r)) * uPointerOn;
  pos += d / r * push * push * 20.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
  gl_PointSize = uSize * uPR * (0.7 + aRand.z * 0.9) * (1.0 + push * 0.5);
  vCol = aRand.y < 0.6 ? uC0 : (aRand.y < 0.88 ? uC1 : uC2);
  vAlpha = uAlpha * (0.5 + 0.5 * e) * (0.65 + 0.35 * aRand.z);
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

// The page's own font stack (--font-sans), so the word is drawn in the face the CSS uses; the literal is the fallback.
const family = () => getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || '"IBM Plex Sans Variable", system-ui, sans-serif';
const probe = document.createElement('canvas').getContext('2d');
/** A CSS colour string as plain sRGB numbers in a three Color (the shader writes them unconverted). */
function cssColour(text, fallback) {
  probe.fillStyle = fallback;
  probe.fillStyle = text;
  return new Color().setStyle(probe.fillStyle, LinearSRGBColorSpace);
}

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const get = (name) => cssColour(style.getPropertyValue(name).trim(), 'gray');
  const bg = get('--bg');
  return { colours: [get('--dot'), get('--dot2'), get('--dot3')], dark: bg.r * 0.3 + bg.g * 0.59 + bg.b * 0.11 < 0.4 };
}

/** The pixels of `word`, drawn to fit `box`, as [x, y] pairs in CSS px relative to the hero art. */
function sampleWord(word, box, W, H) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W));
  c.height = Math.max(1, Math.ceil(H));
  const g = c.getContext('2d', { willReadFrequently: true });
  const font = (px) => `500 ${px}px ${family()}`;
  g.font = font(100);
  const m = g.measureText(word);
  const ratio = Math.min((box.x1 - box.x0) / (m.width || 1), (box.y1 - box.y0) / ((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 72));
  g.font = font(Math.max(8, ratio * 100));
  g.textAlign = 'center';
  const mm = g.measureText(word);
  g.fillText(word, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2);
  const x0 = Math.max(0, Math.floor(box.x0)), y0 = Math.max(0, Math.floor(box.y0));
  const img = g.getImageData(x0, y0, Math.max(1, Math.min(c.width, Math.ceil(box.x1)) - x0), Math.max(1, Math.min(c.height, Math.ceil(box.y1)) - y0));
  const out = [];
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) if (img.data[(y * img.width + x) * 4 + 3] > 110) out.push([x0 + x, y0 + y]);
  }
  return out;
}

/** The right edge of the hero's text and buttons, relative to the art's left edge. */
function textRight(hero, art) {
  const left = art.getBoundingClientRect().left;
  const range = document.createRange();
  const walker = document.createTreeWalker(hero.querySelector('.wrap') || hero, NodeFilter.SHOW_TEXT);
  let right = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) right = Math.max(right, r.right);
  }
  hero.querySelectorAll('.btn, .lede').forEach((el) => { right = Math.max(right, el.getBoundingClientRect().right); });
  return right - left;
}

export async function mount(art) {
  const data = await getData('cycle');
  const word = data && typeof data.heroWord === 'string' && data.heroWord.trim() ? data.heroWord.trim() : 'MVP';
  if (document.fonts && document.fonts.load) {
    await Promise.race([document.fonts.load(`500 120px ${family()}`, word).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  }
  const hero = art.closest('.hero') || art.parentElement;
  let tier = getTier();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: tier === 'full' });
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1); // pixel units, y down
  const u = {
    uTime: { value: 0 }, uAssemble: { value: 0 }, uSize: { value: 2.4 }, uPR: { value: 1 }, uPointerOn: { value: 0 }, uAlpha: { value: 0.9 },
    uPointer: { value: [-999, -999] }, uParallax: { value: [0, 0] }, uGlow: { value: 1 },
    uC0: { value: new Color() }, uC1: { value: new Color() }, uC2: { value: new Color() },
  };
  const material = new ShaderMaterial({
    uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
  });
  let geometry = null, points = null, W = 1, H = 1, wide = true;
  let running = false, visible = true, disposed = false, raf = 0, last = 0, started = 0, quietUntil = 0, frames = 0, mark = 0, resizeTimer = 0;
  const ptr = { x: -999, y: -999, sx: -999, sy: -999, on: 0, goal: 0, parX: 0, parY: 0 };
  const palette = readPalette();
  const colourise = (snap) => {
    ['uC0', 'uC1', 'uC2'].forEach((key, i) => (snap ? u[key].value.copy(palette.colours[i]) : u[key].value.lerp(palette.colours[i], 0.12)));
    u.uGlow.value = palette.dark ? 1 : 0;
  };
  colourise(true);

  function layout() {
    W = Math.max(1, art.clientWidth);
    H = Math.max(1, art.clientHeight);
    camera.right = W;
    camera.bottom = H;
    camera.updateProjectionMatrix();
    u.uPR.value = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[tier]);
    renderer.setPixelRatio(u.uPR.value);
    renderer.setSize(W, H, false);
  }

  /** (Re)builds the particles for the current size and tier: homes on the word, scatter spots, random seeds. */
  function build() {
    wide = WIDE.matches;
    const band = parseFloat(getComputedStyle(art).getPropertyValue('--hero-band')) || 44;
    const wrap = hero.querySelector('.wrap');
    const wrapStyle = wrap ? getComputedStyle(wrap) : null;
    const pad = (wrapStyle && parseFloat(wrapStyle.paddingLeft)) || 24;
    let box;
    if (wide) {
      const clear = textRight(hero, art) + 24;
      art.style.setProperty('--hero-clear', `${clear}px`);
      const edge = wrap ? wrap.getBoundingClientRect().right - parseFloat(wrapStyle.paddingRight) - art.getBoundingClientRect().left : W - pad;
      const x0 = Math.max(clear + 136, W * 0.5); // clear of the mask's fade, which runs 8rem past --hero-clear
      box = { x0, x1: Math.max(x0 + 160, edge), y0: H * 0.16, y1: H * 0.84 };
    } else {
      art.style.removeProperty('--hero-clear');
      box = { x0: pad, x1: W - pad, y0: H - band + 10, y1: H - 8 }; // a small, fainter word in the bottom band
    }
    const spots = sampleWord(word, box, W, H);
    const n = Math.round(COUNTS[tier] * (wide ? 1 : tier === 'lite' ? 0.7 : 0.4)); // the phone word needs a denser share when the count is small
    const rand = rng(0x6b8d + word.length);
    const home = new Float32Array(n * 2), scatter = new Float32Array(n * 2), seed = new Float32Array(n * 4);
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const bell = () => (rand() + rand() + rand() - 1.5) / 1.5;
    for (let i = 0; i < n; i += 1) {
      const s = spots.length ? spots[Math.floor(rand() * spots.length)] : [cx, cy];
      home[i * 2] = s[0] + rand() - 0.5;
      home[i * 2 + 1] = s[1] + rand() - 0.5;
      scatter[i * 2] = wide ? Math.min(W, Math.max(0, cx + bell() * (box.x1 - box.x0) * 0.9)) : box.x0 + rand() * (box.x1 - box.x0);
      scatter[i * 2 + 1] = wide ? Math.min(H, Math.max(0, cy + bell() * H * 0.5)) : box.y0 + rand() * (box.y1 - box.y0);
      seed.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const next = new BufferGeometry();
    next.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3)); // unused; gives three the count
    next.setAttribute('aHome', new Float32BufferAttribute(home, 2));
    next.setAttribute('aScatter', new Float32BufferAttribute(scatter, 2));
    next.setAttribute('aRand', new Float32BufferAttribute(seed, 4));
    if (points) points.geometry = next;
    else {
      points = new Points(next, material);
      points.frustumCulled = false;
      scene.add(points);
    }
    if (geometry) geometry.dispose();
    geometry = next;
    u.uSize.value = wide ? 2.4 : 1.8;
    u.uAlpha.value = wide ? 0.92 : 0.75;
    art.dataset.particles = String(n);
  }

  function frame(now) {
    raf = 0;
    if (!running || disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const ease = (rate) => Math.min(1, dt * rate);
    u.uTime.value += dt;
    u.uAssemble.value = Math.min(1, Math.max(0, (now - started - 350) / 2400));
    ptr.on += (ptr.goal - ptr.on) * ease(6);
    ptr.sx += (ptr.x - ptr.sx) * ease(12);
    ptr.sy += (ptr.y - ptr.sy) * ease(12);
    ptr.parX += ((ptr.goal ? (ptr.x / W - 0.5) * -10 : 0) - ptr.parX) * ease(3);
    ptr.parY += ((ptr.goal ? (ptr.y / H - 0.5) * -8 : 0) - ptr.parY) * ease(3);
    u.uPointer.value = [ptr.sx, ptr.sy];
    u.uParallax.value = [ptr.parX, ptr.parY];
    u.uPointerOn.value = ptr.on;
    colourise(false);
    renderer.render(scene, camera);
    if (art.dataset.state !== 'live') art.dataset.state = 'live';
    frames += 1;
    if (now - mark >= 500) {
      const fps = (frames * 1000) / (now - mark);
      art.dataset.fps = fps.toFixed(1);
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
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // Mouse and pen only; touch has no hover, so on phones the particles just drift.
  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    const r = art.getBoundingClientRect();
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    ptr.goal = 1;
  };
  const onLeave = () => { ptr.goal = 0; };
  const onMode = () => Object.assign(palette, readPalette());
  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerleave', onLeave);
  document.addEventListener('bb:modechange', onMode);
  document.addEventListener('visibilitychange', update);
  const intersect = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; update(); });
  intersect.observe(hero);
  let sized = false;
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
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('bb:modechange', onMode);
    document.removeEventListener('visibilitychange', update);
    if (geometry) geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    art.removeAttribute('data-state');
    art.style.removeProperty('--hero-clear');
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
  art.append(canvas);
  resize.observe(art);
  update();
  return { dispose };
}
