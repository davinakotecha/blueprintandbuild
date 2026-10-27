/*
 * layout.js (frontend-builder). Injects the shared skip link, header (wordmark, primary nav, mode toggle) and
 * footer into every page, so each HTML file stays short. A page provides:
 *   <header data-site-header class="glass site-header"></header>   (CSS reserves its height: no layout shift)
 *   <main id="main"> ... </main>
 *   <footer data-site-footer class="site-footer"></footer>
 * The Slack link appears in the footer only when config.json has the channel address (or the Slack IDs).
 * The header "Search" button opens the search palette; palette.js is imported only on first use (Ctrl/Cmd+K or a click).
 */
import { el } from './dom.js';
import { getData } from './content.js';
import { init as initMode } from './mode.js';
import { NAV, FOOTER_LINKS } from './nav-data.js';
import { channelHref } from './slack.js';
import { webUrl, externalLink } from './home-cards.js';

const currentPage = () => window.location.pathname.split('/').pop() || 'index.html';

function link(label, href, className) {
  const here = href === currentPage();
  return el('a', { href, class: className, 'aria-current': here ? 'page' : null, text: label });
}

function skipLink() {
  const anchor = el('a', { class: 'skip-link', href: '#main', text: 'Skip to main content' });
  anchor.addEventListener('click', (event) => {
    // Works even when a <base> is set (the 404 page) and moves focus, not only the scroll position.
    const main = document.getElementById('main');
    if (!main) return;
    event.preventDefault();
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.scrollIntoView();
  });
  return anchor;
}

function brand() {
  return el('a', { class: 'brand', href: 'index.html' }, [
    el('span', { class: 'brand__mark', 'aria-hidden': 'true' }),
    el('span', { class: 'brand__name', text: 'Blueprint & Build' }),
  ]);
}

/** Below 48rem the nav is a disclosure: aria-expanded, Escape and outside click close it, focus returns. */
function wireDisclosure(header, button, nav) {
  const set = (open, returnFocus) => {
    header.dataset.navOpen = String(open);
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('.nav-toggle__label').textContent = open ? 'Close' : 'Menu';
    if (!open && returnFocus) button.focus();
  };
  button.addEventListener('click', () => set(header.dataset.navOpen !== 'true'));
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.dataset.navOpen === 'true') {
      event.stopPropagation();
      set(false, header.contains(document.activeElement));
    }
  });
  document.addEventListener('click', (event) => {
    if (header.dataset.navOpen === 'true' && !header.contains(event.target)) set(false);
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) set(false);
  });
  window.matchMedia('(min-width: 48rem)').addEventListener('change', (query) => {
    if (query.matches) set(false);
  });
  set(false);
}

const isMac = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');

/**
 * The Search button: an icon on phones, "Search" plus the shortcut text from 66rem. The name "Search" is real text
 * (visually hidden on phones), so the visible label is always part of the accessible name; the shortcut is aria-hidden.
 */
function searchButton() {
  return el('button', { type: 'button', class: 'search-btn', 'data-palette-open': '', 'aria-keyshortcuts': 'Control+K Meta+K' }, [
    el('span', { class: 'search-btn__icon', 'aria-hidden': 'true' }),
    el('span', { class: 'search-btn__label', text: 'Search' }),
    el('span', { class: 'search-btn__keys', 'aria-hidden': 'true', text: isMac ? '⌘K' : 'Ctrl K' }),
  ]);
}

/**
 * Loads palette.js on the first Ctrl/Cmd+K or Search click, then hands over to it (palette.init() registers its own
 * listeners). Until then this is the only palette code on the page.
 */
function lazyPalette() {
  let loading = null;
  let loaded = null;
  let tries = 0;
  const load = (from) => {
    if (loading) return;
    // A browser remembers a failed import() for that exact URL, so each retry adds ?retry=N and gets a clean attempt.
    // Once palette.js is in it is kept (never imported twice) and its own listeners take over. palette.open() never
    // rejects and puts the page back as it was if it fails, so a failed Ctrl/Cmd+K leaves the page fully usable and
    // the next one simply tries again. Only a failure here clears `loading`.
    const source = loaded ? Promise.resolve(loaded) : import(tries ? `./palette.js?retry=${tries}` : './palette.js');
    tries += 1;
    loading = source
      .then((palette) => { loaded = palette; palette.init(); return palette.open(from); })
      .catch(() => { loading = null; });
  };
  const hit = (event) => (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
  document.addEventListener('keydown', (event) => {
    if (hit(event) && !event.defaultPrevented) { event.preventDefault(); load(); }
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-palette-open]');
    if (button && !loading) load(button);
  });
}

function buildHeader(header) {
  const toggle = el('button', {
    type: 'button', class: 'nav-toggle', 'aria-expanded': 'false', 'aria-controls': 'site-nav',
  }, [
    el('span', { class: 'nav-toggle__icon', 'aria-hidden': 'true' }),
    el('span', { class: 'nav-toggle__label', text: 'Menu' }),
  ]);
  const list = el('ul', { class: 'site-nav__list' }, NAV.map(([label, href]) => el('li', {}, link(label, href))));
  const nav = el('nav', { class: 'site-nav', id: 'site-nav', 'aria-label': 'Primary' }, list);
  const modeHost = el('div', { class: 'mode-toggle', 'data-mode-toggle': '' });

  header.replaceChildren(el('div', { class: 'wrap site-header__bar' }, [brand(), toggle, nav, searchButton(), modeHost]));
  wireDisclosure(header, toggle, nav);
  initMode(modeHost);
  lazyPalette();
}

function buildFooter(footer) {
  const links = el('ul', { class: 'site-footer__links' }, FOOTER_LINKS.map(([label, href]) => el('li', {}, link(label, href))));
  const notes = el('div', { class: 'site-footer__notes' });
  footer.replaceChildren(el('div', { class: 'wrap site-footer__inner' }, [
    el('p', { class: 'site-footer__name mono', text: 'Blueprint & Build · AI & Analytics practice · Asset Based Consulting · Knowledge Share' }),
    el('nav', { 'aria-label': 'Footer' }, links),
    notes,
  ]));
  return { links, notes };
}

async function addConfigNotes({ links }) {
  const config = await getData('config');
  if (!config) return;
  const name = config.slack && typeof config.slack.channelName === 'string' ? config.slack.channelName.trim() : '';
  if (!name) return;
  const web = webUrl(config.links && config.links.slackChannel);
  if (web) {
    links.append(el('li', {}, externalLink(web, `Join #${name} on Slack`)));
    return;
  }
  const href = channelHref(config);
  if (href) links.append(el('li', {}, el('a', { href, text: `Join #${name} on Slack` })));
}

/**
 * "Last updated 25 Oct 2026, 14:32" from data/version.json (written when the site is built), so anyone can tell
 * whether the live site has the latest upload. Shown in the visitor's time zone. A missing or odd file shows nothing.
 */
async function addBuildDate({ notes }) {
  const version = await getData('version');
  const built = version && typeof version.built === 'string' ? new Date(version.built) : null;
  if (!built || Number.isNaN(built.getTime())) return;
  const date = built.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = built.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  notes.append(el('p', { class: 'site-footer__built mono', text: `Last updated ${date}, ${time}` }));
}

/** tier.js writes data-tier on <html> when it loads. Pages without a hero would never load it otherwise. */
function loadTier() {
  import('./tier.js').catch(() => {
    // Not there (yet): the page stays in the static look, which is fine.
  });
}

function start() {
  loadTier();
  document.body.prepend(skipLink());
  const header = document.querySelector('[data-site-header]');
  if (header) buildHeader(header);
  const footer = document.querySelector('[data-site-footer]');
  if (footer) {
    const parts = buildFooter(footer);
    addConfigNotes(parts);
    addBuildDate(parts);
  }
}

start();
