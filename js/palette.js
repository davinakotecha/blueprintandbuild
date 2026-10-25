/*
 * palette.js (frontend-builder B). The search palette. It is loaded lazily: layout.js imports it the first time
 * someone presses Ctrl/Cmd+K or uses the header "Search" button, so Home's first paint never pays for it.
 *
 *   init()           registers the shortcut and the [data-palette-open] buttons (once)
 *   open(opener)     opens the dialog; focus returns to `opener` (or what had focus) on close. Never rejects:
 *                    it resolves true when the palette is open and false when it could not open.
 *
 * Pattern: a modal role="dialog" holding a labelled role="combobox" input and a role="listbox" of up to 8 results,
 * focus kept on the input with aria-activedescendant. The page behind is inert while it is open.
 * Results come from nav-data.js PAGES, mvps.json and skills.json. DOM is built with el() and textContent only.
 *
 * Failing safe: everything that can throw (styles, building, ranking, rendering) runs BEFORE the page is made inert,
 * and inert goes on last. If anything throws, closePalette() undoes whatever was done (inert, the has-palette class
 * and the scroll lock) and the page is exactly as it was. closePalette() is idempotent and works before the UI exists.
 */
import { el } from './dom.js';
import { getData } from './content.js';
import { PAGES } from './nav-data.js';
import { rank, buildIndex } from './palette-search.js';

const MAX = 8;
let ui = null;
let ready = false;
let opening = false;
let index = buildIndex(PAGES, [], []);
let results = [];
let active = -1;
let opener = null;
let inerted = [];
let countTimer = 0;

const shown = () => Boolean(ui && !ui.root.hidden);
/** Links are resolved against the page's base URL, so the 404 page (<base href="/">) and a Pages sub-path both work. */
const resolve = (href) => new URL(href, document.baseURI);

function loadStyles() {
  const href = new URL('../css/palette.css', import.meta.url).href;
  if ([...document.styleSheets].some((sheet) => sheet.href === href)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = el('link', { rel: 'stylesheet', href });
    const done = () => resolve();
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
    window.setTimeout(done, 1500);
    document.head.append(link);
  });
}

function build() {
  const input = el('input', {
    type: 'text', id: 'palette-input', class: 'palette__input', role: 'combobox', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list', 'aria-describedby': 'palette-count',
  });
  const close = el('button', { type: 'button', class: 'palette__close', 'aria-label': 'Close search', text: 'Close' });
  const list = el('ul', { id: 'palette-list', class: 'palette__list', role: 'listbox', 'aria-label': 'Results' });
  const empty = el('p', { class: 'palette__empty', hidden: true });
  const count = el('p', { id: 'palette-count', role: 'status', 'aria-live': 'polite' });
  const panel = el('div', { class: 'palette__panel glass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'palette-label' }, [
    el('div', { class: 'palette__bar' }, [el('label', { id: 'palette-label', for: 'palette-input', text: 'Search' }), input, close]),
    list, empty,
    el('div', { class: 'palette__foot' }, [count, el('p', { class: 'palette__keys', 'aria-hidden': 'true', text: 'Up and Down to move · Enter to open' })]),
  ]);
  const root = el('div', { class: 'palette', 'data-palette': '', hidden: true }, panel);
  try {
    document.body.append(root);
    input.addEventListener('input', update);
    close.addEventListener('click', () => closePalette());
    root.addEventListener('mousedown', (event) => {
      if (event.target !== root) return;
      event.preventDefault(); // otherwise the click's default action blurs the opener we are about to focus
      closePalette();
    });
    list.addEventListener('mousemove', (event) => {
      const option = event.target.closest('[role="option"]');
      if (option && Number(option.dataset.at) !== active) select(Number(option.dataset.at), false);
    });
    list.addEventListener('click', (event) => {
      const option = event.target.closest('[role="option"]');
      if (option) go(results[Number(option.dataset.at)]);
    });
    root.addEventListener('keydown', onKey);
  } catch (error) {
    root.remove(); // never leave a half-built dialog in the page; the next open() builds a fresh one
    throw error;
  }
  ui = { root, panel, input, close, list, empty, count };
}

function select(at, scroll = true) {
  active = at;
  ui.list.querySelectorAll('[role="option"]').forEach((option, i) => option.setAttribute('aria-selected', String(i === at)));
  const option = ui.list.children[at];
  if (option) {
    ui.input.setAttribute('aria-activedescendant', option.id);
    if (scroll) option.scrollIntoView({ block: 'nearest' });
  } else {
    ui.input.removeAttribute('aria-activedescendant');
  }
}

function render() {
  const found = rank(index, ui.input.value, MAX);
  const options = found.map((item, i) => el('li', { id: `palette-opt-${i}`, role: 'option', class: 'palette__option', 'data-at': i, 'aria-selected': 'false' }, [
    el('span', { class: 'palette__title', text: item.title }),
    el('span', { class: 'palette__kind', text: item.kind }),
    item.description ? el('span', { class: 'palette__desc', text: item.description }) : null,
  ]));
  results = found;
  ui.list.replaceChildren(...options);
  const none = results.length === 0;
  ui.list.hidden = none;
  ui.empty.hidden = !none;
  ui.input.setAttribute('aria-expanded', String(!none));
  if (none) ui.empty.textContent = `No results for “${ui.input.value.trim()}”. Try a page name such as MVPs, Skills or Vote.`;
  select(none ? -1 : 0);
}

function announce() {
  window.clearTimeout(countTimer);
  countTimer = window.setTimeout(() => {
    if (ui) ui.count.textContent = results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No results';
  }, 250);
}

function update() {
  try {
    render();
    announce();
  } catch {
    closePalette(); // a search that cannot run must never trap the visitor in a modal
  }
}

function go(item) {
  if (!item) return;
  const target = resolve(item.href);
  const same = target.href === window.location.href;
  closePalette(false);
  if (!same) window.location.assign(target.href);
}

function onKey(event) {
  const last = results.length - 1;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (last >= 0) select(event.key === 'ArrowDown' ? (active >= last ? 0 : active + 1) : (active <= 0 ? last : active - 1));
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    if (last >= 0) select(event.key === 'Home' ? 0 : last);
  } else if (event.key === 'Enter' && event.target === ui.input) {
    event.preventDefault();
    go(results[active]);
  } else if (event.key === 'Tab') {
    const stops = [ui.input, ui.close];
    const at = stops.indexOf(document.activeElement);
    event.preventDefault();
    stops[(at + (event.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
  }
}

/** Each node is remembered before it is changed, so a failure half way still lets inertBackground(false) undo it. */
function inertBackground(on) {
  if (on) {
    const nodes = [...document.body.children].filter((node) => node !== ui.root && !node.inert && node.tagName !== 'SCRIPT');
    nodes.forEach((node) => { inerted.push(node); node.inert = true; });
  } else {
    const nodes = inerted;
    inerted = [];
    nodes.forEach((node) => { node.inert = false; });
  }
}

async function loadResults() {
  try {
    const [mvps, skills] = await Promise.all([getData('mvps'), getData('skills')]);
    index = buildIndex(PAGES, mvps, skills);
    if (shown()) update();
  } catch {
    // Keep the pages-only index: search still works, it just finds fewer things.
  }
}

export async function open(from) {
  if (shown() || opening) return shown();
  opening = true;
  opener = from || document.activeElement;
  try {
    await loadStyles();
    if (!ui) build();
    if (shown()) return true;
    ui.input.value = '';
    ui.count.textContent = '';
    render(); // all the work that can fail is done before anything about the page changes
    ui.root.hidden = false;
    document.documentElement.classList.add('has-palette');
    inertBackground(true); // last: from here on only closePalette() is needed to get the page back
    ui.input.focus();
    if (!ready) {
      ready = true;
      loadResults();
    }
    return true;
  } catch {
    closePalette();
    return false;
  } finally {
    opening = false;
  }
}

/** Safe at any time: before the UI exists, when it is already closed, or half-open after an error. */
export function closePalette(returnFocus = true) {
  const wasOpen = shown();
  window.clearTimeout(countTimer);
  if (ui) ui.root.hidden = true;
  document.documentElement.classList.remove('has-palette');
  try {
    inertBackground(false);
  } finally {
    if (wasOpen && returnFocus && opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }
}

let started = false;
export function init() {
  if (started) return;
  started = true;
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (shown()) closePalette();
      else open();
    }
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-palette-open]');
    if (button) open(button);
  });
}
