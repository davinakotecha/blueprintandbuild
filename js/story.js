/*
 * story.js (creative-dev): the How it works page.
 *
 * Layer 1, for everyone: renders data/pages.json into [data-scroll-story] with createElement and textContent only: the
 * steps as a plain ordered list (.steps), the ground rules, the FAQ as native <details>, and the builder cards.
 * A missing or malformed pages.json gives a placeholder card, never a blank page. This is all the static tier,
 * reduced motion and a failed script ever show.
 * A step may carry a link ({ label, href } in pages.json). It is checked here as well: a string label and a relative
 * page path (name.html or name.html#id); anything else shows no link.
 *
 * Layer 2, full and lite tiers only: pin() turns the list into a pinned story. A sticky stage (aria-hidden) shows a
 * progress track over the six steps (two months), the active step's title large and kinetic, and a motif that
 * reads --dot/--dot2/--dot3. The list stays the single source of truth for assistive tech: the active <li> carries
 * aria-current="step", and nothing is duplicated for a screen reader. The active step is the one under the reading
 * line (the last step whose top has passed it; the first when the line is above them all, the last when it is below).
 * Two things keep it right: an IntersectionObserver on a thin band at the line, and a passive scroll listener
 * (throttled to one run per frame, like the resize, hashchange and load ones) that covers jumps which never cross the
 * band (scrollTo, a scrollbar drag, a reload that restores a scroll position, find-in-page).
 * Where CSS scroll timelines exist (animation-timeline: view(), behind @supports in story-stage.css) each step gets a
 * named view timeline that drives the track fill and the title's weight and width; elsewhere those follow the active
 * step with transitions.
 * The full tier adds a small 2D canvas for the motif after load and idle; lite keeps the CSS motif.
 *
 * pin() never traps scroll or focus (nothing is captured; the stage has no focusable content) and returns a
 * teardown that restores layer 1 exactly and removes every listener it added. It runs when the tier drops to static
 * or reduced motion is switched on.
 */
import { getData } from './content.js';
import { el } from './dom.js';
import { getTier, onTierChange } from './tier.js';

const host = document.querySelector('[data-scroll-story]');
const MONTH = { blueprint: 'Blueprint month', build: 'Build month' };
const LINK_HREF = /^[a-z0-9-]+\.html(#[a-z0-9-]+)?$/; // a page of this site, optionally with an #id: never a scheme, a slash or ..
const LINE = 0.4; // the reading line, as a share of the window height: the last step whose top has passed it is the active one
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const TIMELINES = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: --a');

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);
const safeId = (v, i) => (/^[a-z0-9-]{1,40}$/i.test(text(v)) ? text(v) : String(i + 1));

/** The step's optional link, or null when it is missing or does not pass the checks. */
function stepLink(step) {
  const link = step && step.link;
  if (!link || typeof link !== 'object') return null;
  const label = text(link.label);
  const href = text(link.href);
  if (!label || !LINK_HREF.test(href)) return null;
  return { label, href };
}

/* ------------------------------------------------------------------ layer 1: render */
function stepItem(s, i) {
  const month = s.month === 'build' ? 'build' : 'blueprint';
  const link = stepLink(s);
  return el('li', { class: 'step', id: `step-${safeId(s.id, i)}`, 'data-month': month }, [
    el('div', { class: 'step__meta' }, [
      el('span', { class: 'step__no', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: month === 'build' ? 'tag tag--b' : 'tag', text: MONTH[month] }),
    ]),
    el('h3', { class: 'step__title', text: s.title }),
    text(s.summary) ? el('p', { class: 'step__summary', text: s.summary }) : null,
    text(s.detail) ? el('p', { class: 'step__detail', text: s.detail }) : null,
    link ? el('a', { class: 'text-link', href: link.href }, [link.label, ' ', el('span', { 'aria-hidden': 'true', text: '→' })]) : null,
  ]);
}

function block(id, title, body, cls = '') {
  return el('section', { class: `section ${cls}`.trim(), 'aria-labelledby': id }, el('div', { class: 'wrap' }, [
    el('h2', { id, class: 'reveal', text: title }),
    body,
  ]));
}

function render(how, builders, config, cards) {
  const steps = list(how && how.steps).filter((s) => s && text(s.title));
  const rules = list(how && how.rules).filter((r) => r && text(r.title));
  const faq = list(how && how.faq).filter((f) => f && text(f.q) && text(f.a));
  const parts = [];
  const none = (title, message) => (cards ? cards.placeholderCard(title, message) : el('p', { class: 'placeholder-note', text: message }));

  if (steps.length) {
    parts.push(el('section', { class: 'story section', 'aria-labelledby': 'story-title' }, el('div', { class: 'wrap' }, [
      el('h2', { id: 'story-title', text: 'The cycle, step by step' }),
      el('div', { class: 'story__body' }, el('ol', { class: 'steps' }, steps.map(stepItem))),
    ])));
  } else {
    const missing = 'The step-by-step guide is not available right now. In short: ideas are open all the time, the practice votes in Slack, and two builders ship the winner.';
    parts.push(block('story-title', 'The cycle, step by step', none('Steps are on the way', missing)));
  }
  if (rules.length) {
    const ruleCards = rules.map((r, i) => el('li', { class: 'card surface reveal' }, [
      el('span', { class: 'rule__no', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
      el('h3', { text: r.title }),
      text(r.text) ? el('p', { text: r.text }) : null,
    ]));
    parts.push(block('rules-title', 'Ground rules', el('ul', { class: 'rules bento' }, ruleCards)));
  }
  if (faq.length) {
    const entries = faq.map((f) => el('details', { class: 'reveal' }, [
      el('summary', { text: f.q }),
      el('div', { class: 'faq__a' }, el('p', { text: f.a })),
    ]));
    parts.push(block('faq-title', 'Questions people ask', el('div', { class: 'faq' }, entries)));
  }
  // One bad builder entry (null, a number) is skipped, never allowed to stop the steps, rules and FAQ above from drawing.
  const people = cards ? list(builders).filter((b) => b && typeof b === 'object').slice(0, 2) : [];
  const built = people.map((b) => {
    try {
      return cards.builderCard(b, config);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const cardNodes = built.length ? built : [none('Builders', 'Builder details will appear here.')];
  cardNodes.forEach((card) => card.classList.add(built.length === 2 ? 'span-3' : 'span-6', 'reveal'));
  parts.push(block('builders-title', 'Meet the builders', el('div', { class: 'bento builders' }, cardNodes)));
  host.replaceChildren(...parts);
  host.removeAttribute('aria-busy');
  const intro = document.querySelector('[data-hiw-intro]');
  if (intro && text(how && how.intro)) intro.textContent = how.intro;
}

/**
 * The steps are drawn after the data arrives, so when the page is opened at how-it-works.html#step-vote the
 * browser's own jump to the fragment finds nothing and stays at the top. Do that jump once, now that the element
 * exists. Only an element inside the story is followed, and the id is looked up (never used as a selector).
 */
function scrollToHash() {
  let id = '';
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  if (!id) return;
  const target = document.getElementById(id);
  if (target && host.contains(target)) target.scrollIntoView();
}

/* ------------------------------------------------------------------ the motif canvas (full tier) */
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

const N = 84;
// One formation per step, in [-1, 1] on both axes: ideas drift loose, triage sorts into three, vote rises as bars,
// scope frames a square, build lays a grid, drop opens like a sunflower.
const SHAPES = [
  (k, p) => [p.hx, p.hy],
  (k) => [((k % 3) - 1) * 1.15 + Math.cos(k * 2.4) * 0.28, Math.sin(k * 2.4) * 0.4],
  (k) => [
    ((k % 3) - 1) * 1.1 + (((k * 7) % 5) - 2) * 0.04,
    0.9 - (1 - Math.floor(k / 3) / (N / 3 - 1)) * [1.8, 1.25, 0.7][k % 3],
  ],
  (k) => {
    const t = ((k >> 1) / (N / 2)) * 4;
    const s = Math.floor(t);
    const f = t - s;
    const r = k % 2 ? 0.52 : 0.85;
    return [[-1 + 2 * f, 1, 1 - 2 * f, -1][s] * r, [-1, -1 + 2 * f, 1, 1 - 2 * f][s] * r];
  },
  (k) => [((k % 12) / 11) * 1.8 - 0.9, (Math.floor(k / 12) / 6) * 1.5 - 0.75],
  (k) => {
    const r = Math.sqrt((k + 0.5) / N) * 0.95;
    const a = k * 2.399963;
    return [Math.cos(a) * r, Math.sin(a) * r];
  },
];

function mountMotif(box) {
  const canvas = el('canvas', { 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  if (!g) return null;
  const rand = rng(0x5eed);
  const P = Array.from({ length: N }, (_, k) => ({
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    tx: 0,
    ty: 0,
    hx: rand() * 2 - 1,
    hy: rand() * 2 - 1,
    c: k % 3,
    r: 0.9 + rand() * 1.4,
    ph: rand() * 6.283,
    rate: 2.5 + rand() * 3,
  }));
  let cols = [];
  let step = 0;
  let W = 1;
  let H = 1;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let on = false;
  let seen = true;
  let dead = false;

  const readCols = () => {
    const s = getComputedStyle(document.documentElement);
    cols = ['--dot', '--dot2', '--dot3'].map((v) => s.getPropertyValue(v).trim() || 'gray');
  };
  const aim = () => P.forEach((p, k) => {
    [p.tx, p.ty] = SHAPES[step % SHAPES.length](k, p);
  });
  const size = () => {
    W = Math.max(1, box.clientWidth);
    H = Math.max(1, box.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  function frame(now) {
    raf = 0;
    if (!on) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    g.clearRect(0, 0, W, H);
    const sx = W * 0.44;
    const sy = H * 0.44;
    P.forEach((p) => {
      const e = 1 - Math.exp(-dt * p.rate);
      p.x += (p.tx - p.x) * e;
      p.y += (p.ty - p.y) * e;
    });
    for (let c = 0; c < 3; c += 1) {
      g.fillStyle = cols[c];
      g.beginPath();
      for (const p of P) {
        if (p.c !== c) continue;
        const x = W / 2 + (p.x + Math.sin(now / 1100 + p.ph) * 0.03) * sx;
        const y = H / 2 + (p.y + Math.cos(now / 1300 + p.ph) * 0.03) * sy;
        g.moveTo(x + p.r, y);
        g.arc(x, y, p.r, 0, 6.2832);
      }
      g.fill();
    }
    if (box.dataset.state !== 'live') box.dataset.state = 'live';
    raf = requestAnimationFrame(frame);
  }

  const update = () => {
    const want = seen && !document.hidden && !dead;
    if (want === on) return;
    on = want;
    if (on) {
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver((e) => {
    seen = e[e.length - 1].isIntersecting;
    update();
  });
  const ro = new ResizeObserver(size);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('bb:modechange', readCols);
  readCols();
  size();
  aim();
  box.append(canvas);
  io.observe(box);
  ro.observe(box);
  update();
  return {
    setStep(i) {
      step = i;
      aim();
    },
    dispose() {
      dead = true;
      update();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', update);
      document.removeEventListener('bb:modechange', readCols);
      canvas.remove();
      box.removeAttribute('data-state');
    },
  };
}

/* ------------------------------------------------------------------ layer 2: the pinned story */
function whenIdle(fn) {
  const run = () => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

function pin(story) {
  const body = story.querySelector('.story__body');
  const items = [...story.querySelectorAll('.step')];
  if (!body || items.length < 2) return null;
  const n = items.length;

  const months = [];
  items.forEach((li) => {
    const last = months[months.length - 1];
    if (last && last.month === li.dataset.month) last.count += 1;
    else months.push({ month: li.dataset.month, count: 1 });
  });
  const cells = items.map((_, i) => el('div', { class: 'track__cell', 'data-s': 'todo' }, [
    el('span', { class: 'track__seg' }),
    el('span', { class: 'track__node', text: String(i + 1) }),
  ]));
  const monthLabels = months.map((m) => {
    const label = el('div', { class: 'track__month', text: MONTH[m.month] });
    label.style.gridColumn = `span ${m.count}`;
    return label;
  });
  const track = el('div', { class: 'track' }, [
    el('div', { class: 'track__months' }, monthLabels),
    el('div', { class: 'track__rail' }, cells),
  ]);
  track.style.setProperty('--n', String(n));
  const kicker = el('p', { class: 'eyebrow stage__kicker' });
  const titles = items.map((li) => el('p', { class: 'display stage__t' }, el('span', { class: 'stage__w', text: li.querySelector('.step__title').textContent })));
  const motif = el('div', { class: 'motif' });
  const stage = el('div', { class: 'stage', 'aria-hidden': 'true' }, [
    track,
    el('div', { class: 'stage__now' }, [kicker, el('div', { class: 'stage__titles' }, titles)]),
    motif,
  ]);

  if (TIMELINES) { // CSS scroll timelines: one named view timeline per step, hoisted to .story so the stage can use them
    story.style.setProperty('timeline-scope', items.map((_, i) => `--s${i}`).join(', '));
    items.forEach((li, i) => li.style.setProperty('view-timeline-name', `--s${i}`));
    cells.forEach((c, i) => {
      c.firstChild.style.setProperty('animation-timeline', `--s${i}`);
      c.firstChild.style.setProperty('animation-range', 'cover 20% cover 80%');
    });
    titles.forEach((t, i) => {
      t.firstChild.style.setProperty('animation-timeline', `--s${i}`);
      t.firstChild.style.setProperty('animation-range', 'cover 30% cover 70%');
    });
  }

  let active = -1;
  let motifApi = null;
  let alive = true;
  let raf = 0;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    story.style.setProperty('--i', String(i));
    items.forEach((li, k) => (k === i ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
    cells.forEach((c, k) => {
      c.dataset.s = k < i ? 'done' : k === i ? 'on' : 'todo';
    });
    titles.forEach((t, k) => t.classList.toggle('is-active', k === i));
    kicker.textContent = `Step ${i + 1} of ${n} · ${MONTH[items[i].dataset.month]}`;
    if (motifApi) motifApi.setStep(i);
  };

  // The step under the reading line: the last one whose top has passed it. Above the first step that is step 1 and
  // below the last it is the last, so there is always exactly one. When the whole story is above or below the line,
  // one rect read settles it and the steps are not measured.
  const probe = () => {
    const line = window.innerHeight * LINE;
    const area = body.getBoundingClientRect();
    if (area.top > line) return 0;
    if (area.bottom <= line) return n - 1;
    let at = 0;
    items.forEach((li, k) => {
      if (li.getBoundingClientRect().top <= line) at = k;
    });
    return at;
  };
  const run = () => {
    if (alive) setActive(probe());
  };
  // Scroll, resize, hashchange, load and layout changes all land here: at most one run per frame.
  const queue = () => {
    if (!alive || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      run();
    });
  };

  const io = new IntersectionObserver(run, { rootMargin: `-${LINE * 100}% 0px -${99 - LINE * 100}% 0px` }); // a thin band at the reading line
  const header = document.querySelector('[data-site-header]');
  const sizer = new ResizeObserver(() => {
    story.style.setProperty('--stage-h', `${stage.offsetHeight}px`);
    if (header) story.style.setProperty('--hdr', `${header.offsetHeight}px`);
    queue(); // a font swap or a wrapped line can move the steps under the line without any scroll
  });

  body.prepend(stage);
  items.forEach((li) => li.querySelector('.step__title').classList.add('sr-only')); // the stage shows the title large; the list keeps it for screen readers
  story.classList.add('is-pinned');
  setActive(probe());
  items.forEach((li) => io.observe(li));
  sizer.observe(stage);
  sizer.observe(body);
  if (header) sizer.observe(header);
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('hashchange', queue);
  if (document.readyState === 'complete') queue();
  else window.addEventListener('load', queue, { once: true });

  function teardown() {
    if (!alive) return;
    alive = false;
    io.disconnect();
    sizer.disconnect();
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', queue);
    window.removeEventListener('resize', queue);
    window.removeEventListener('hashchange', queue);
    window.removeEventListener('load', queue);
    reduce.removeEventListener('change', onReduce);
    offTier();
    if (motifApi) motifApi.dispose();
    stage.remove();
    story.classList.remove('is-pinned');
    ['--i', '--stage-h', '--hdr', 'timeline-scope'].forEach((p) => story.style.removeProperty(p));
    items.forEach((li) => {
      li.removeAttribute('aria-current');
      li.style.removeProperty('view-timeline-name');
      li.querySelector('.step__title').classList.remove('sr-only');
    });
  }
  const onReduce = (e) => {
    if (e.matches) teardown();
  };
  reduce.addEventListener('change', onReduce);
  const offTier = onTierChange((t) => {
    if (t === 'static') {
      teardown();
    } else if (t === 'lite' && motifApi) {
      motifApi.dispose();
      motifApi = null;
    }
  });
  if (getTier() === 'full') {
    whenIdle(() => {
      if (!alive || getTier() !== 'full' || motifApi) return;
      motifApi = mountMotif(motif);
      if (motifApi) motifApi.setStep(active);
    });
  }
  return { teardown };
}

async function start() {
  if (!host) return;
  const [pages, builders, config, cards] = await Promise.all([
    getData('pages'), getData('builders'), getData('config'), import('./home-cards.js').catch(() => null),
  ]);
  render(pages && typeof pages === 'object' ? pages.howItWorks : null, builders, config, cards);
  const story = host.querySelector('.story');
  if (story && getTier() !== 'static' && !reduce.matches) pin(story);
  scrollToHash(); // after pinning: the pinned layout has its own scroll offset for the steps
}

start();
