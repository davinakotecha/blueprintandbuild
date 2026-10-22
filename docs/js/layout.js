/*
 * layout.js (frontend-builder). Injects the shared skip link, header (wordmark, primary nav, mode toggle) and
 * footer into every page, so each HTML file stays short. A page provides:
 *   <header data-site-header class="glass site-header"></header>   (CSS reserves its height: no layout shift)
 *   <main id="main"> ... </main>
 *   <footer data-site-footer class="site-footer"></footer>
 * The Slack link and the sample-content notice appear in the footer only when config.json says so.
 */
import { el } from './dom.js';
import { getData } from './content.js';
import { init as initMode } from './mode.js';

const NAV = [
  ['Home', 'index.html'],
  ['MVPs', 'catalog.html'],
  ['Skills', 'skills.html'],
  ['Vote', 'vote.html'],
  ['How it works', 'how-it-works.html'],
];

const FOOTER_LINKS = [
  ['How it works', 'how-it-works.html'],
  ['Hall of fame', 'hall-of-fame.html'],
  ['Submit an idea', 'submit.html'],
];

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

  header.replaceChildren(el('div', { class: 'wrap site-header__bar' }, [brand(), toggle, nav, modeHost]));
  wireDisclosure(header, toggle, nav);
  initMode(modeHost);
}

function buildFooter(footer) {
  const links = el('ul', { class: 'site-footer__links' }, FOOTER_LINKS.map(([label, href]) => el('li', {}, link(label, href))));
  const notes = el('div', { class: 'site-footer__notes' });
  footer.replaceChildren(el('div', { class: 'wrap site-footer__inner' }, [
    el('p', { class: 'site-footer__name mono', text: 'Blueprint & Build · AI & Analytics practice' }),
    el('nav', { 'aria-label': 'Footer' }, links),
    notes,
  ]));
  return { links, notes };
}

function slackChannelHref(config) {
  const slack = config && config.slack;
  if (!config || !config.features || config.features.slackLinks !== true) return null;
  if (!slack || !slack.teamId || !slack.channelId) return null;
  return `slack://channel?team=${encodeURIComponent(slack.teamId)}&id=${encodeURIComponent(slack.channelId)}`;
}

async function addConfigNotes({ links, notes }) {
  const config = await getData('config');
  if (!config) return;
  const href = slackChannelHref(config);
  const name = config.slack && typeof config.slack.channelName === 'string' ? config.slack.channelName.trim() : '';
  if (href && name) links.append(el('li', {}, el('a', { href, text: `Join #${name} on Slack` })));
  if (config.features && config.features.sampleContent === true) {
    notes.append(el('p', { class: 'site-footer__sample', text: 'Sample content: the MVPs, skills and shortlist shown here are examples.' }));
  }
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
  if (footer) addConfigNotes(buildFooter(footer));
}

start();
