/*
 * home-cards.js (frontend-builder). The card builders shared by Home, the catalog, the skills page and the vote
 * page: MVPs, Claude skills, builders, and the placeholder shown when a list is missing. All DOM comes from
 * createElement and textContent (via dom.js); data never goes through innerHTML. Outbound links must be https
 * (no credentials) and downloads and photos must be relative paths on this site; anything else is treated as "not
 * set" and the element is left out. mvpCard and skillCard take { detail: true } on the catalog and skills pages for
 * the extra facts (cycle, idea owner, builders, version) and the demo link. Every repeated action on a card (Download,
 * Copy link, Open, Copy for Claude Code, Watch demo) gets an aria-label "<visible text> for <card title>".
 */
import { el, text, list, labelOf, attempt } from './dom.js';
import { userHref } from './slack.js';
import { copyButton } from './clipboard.js';
import { enableDragDownload } from './drag.js';

export const TYPE_LABEL = { code: 'Code', platform: 'Platform', skill: 'Claude skill', file: 'File' };
export const STATUS_LABEL = { idea: 'Idea', building: 'Building', live: 'Live', retired: 'Retired' };

const absolute = (href) => new URL(href, window.location.href).href;

/** The id of a card, only if it is safe to use as an element id (data ids are slugs). */
const cardId = (value) => (/^[a-z0-9][a-z0-9_-]*$/i.test(text(value)) ? text(value) : null);

/** A link to catalog.html or skills.html that lands on one card; just the page if the id is not a safe slug. */
export const cardLink = (page, id) => (cardId(id) ? `${page}#${cardId(id)}` : page);

/** A skill name that is safe to put in an install command (lower-case letters, digits, hyphens), or ''. */
export const safeSkillName = (value) => (/^[a-z0-9][a-z0-9-]*$/.test(text(value)) && text(value).length <= 64 ? text(value) : '');

/** The accessible name of a repeated card action: its visible text first (WCAG 2.5.3), then the card it belongs to. */
export const actionLabel = (visible, title) => `${visible} for ${title}`;

/**
 * A public https link, or ''. The build already refuses anything else (scripts/lib/schemas-core.mjs, linkProblem);
 * this repeats the same rules on the page in case the data was not built by that script: https only, no user name or
 * password, no backslash or whitespace, and a real website name, not localhost or a numeric (IP) host. Numeric hosts
 * written as one number (https://2130706433/) are normalised to dotted form by URL, so they are caught as well.
 */
export function webUrl(value) {
  const raw = text(value);
  if (!raw || /[\s\\]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.replace(/\.$/, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return '';
    return url.href;
  } catch {
    return '';
  }
}

/**
 * A same-origin relative path (a download or a photo from the data files), or '' if it is anything else:
 * no scheme, no leading slash (so no `//host`), no backslash, no control characters, no `..` segment (also when
 * percent-encoded). `prefix`, when given, is the folder it must start with. The result must resolve to this origin.
 */
export function sitePath(value, prefix = '') {
  const raw = text(value);
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('/') || raw.includes('\\')) return '';
  if ([...raw].some((char) => char.charCodeAt(0) < 32)) return '';
  if (prefix && !raw.startsWith(prefix)) return '';
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('\\') || decoded.split('/').includes('..')) return '';
    return new URL(raw, window.location.href).origin === window.location.origin ? raw : '';
  } catch {
    return '';
  }
}

export function placeholderCard(title, message) {
  return el('article', { class: 'card' }, [
    el('span', { class: 'tag tag--b', text: 'Coming soon' }),
    el('h3', { text: title }),
    el('p', { text: message }),
  ]);
}

/**
 * An outbound link: new tab, no opener, announced to screen readers, marked for the security scan. `name`, when
 * given, is the full accessible name (it starts with the visible label); "(opens in a new tab)" is added to it.
 */
export function externalLink(href, label, className = '', name = '') {
  return el('a', {
    class: className || null,
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    'data-external': true,
    'aria-label': name ? `${name} (opens in a new tab)` : null,
  }, [label, el('span', { class: 'sr-only', text: ' (opens in a new tab)' })]);
}

/** A <dl> of label and value rows; rows with an empty value are left out, and so is the list if none remain. */
function facts(rows) {
  const shown = rows.filter(([, value]) => value);
  if (!shown.length) return null;
  return el('dl', { class: 'facts' }, shown.map(([label, value]) => el('div', {}, [
    el('dt', { text: label }), el('dd', { text: value }),
  ])));
}

const downloadLabel = (file) => (file.toLowerCase().endsWith('.zip') ? 'Download .zip' : 'Download');
const downloadLink = (file, title) => el('a', {
  class: 'btn', href: file, download: '', text: downloadLabel(file), 'aria-label': actionLabel(downloadLabel(file), title),
});
const comingSoon = () => el('span', { class: 'btn-note', text: 'Link coming soon' });

function mvpPrimary(mvp, file, platform, title) {
  if (mvp.type === 'platform') return platform ? externalLink(platform, 'Open', 'btn', actionLabel('Open', title)) : comingSoon();
  return file ? downloadLink(file, title) : comingSoon();
}

function mvpFacts(mvp) {
  return facts([
    ['Cycle', Number.isInteger(mvp.cycle) ? String(mvp.cycle) : ''],
    ['Idea owner', text(mvp.ideaOwner)],
    ['Built by', list(mvp.builders).join(', ')],
  ]);
}

export function mvpCard(mvp, { detail = false } = {}) {
  const file = sitePath(mvp.download, 'downloads/');
  const platform = webUrl(mvp.links && mvp.links.platform);
  const demo = detail ? webUrl(mvp.links && mvp.links.demo) : '';
  const tags = list(mvp.tags).filter((tag) => tag.toLowerCase() !== 'sample');
  const target = platform || absolute(file || cardLink('catalog.html', mvp.id));
  const title = text(mvp.title) || 'Untitled MVP';

  const card = el('article', { class: 'card surface', id: cardId(mvp.id) }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Status and type' }, [
      el('li', {}, el('span', { class: 'tag', text: labelOf(STATUS_LABEL, mvp.status, 'MVP') })),
      el('li', {}, el('span', { class: 'tag tag--b', text: labelOf(TYPE_LABEL, mvp.type, 'MVP') })),
      mvp.sample ? el('li', {}, el('span', { class: 'tag', text: 'Sample' })) : null,
    ]),
    el('h3', { text: title }),
    el('p', { text: text(mvp.problem) }),
    detail ? mvpFacts(mvp) : null,
    tags.length ? el('p', { class: 'card__meta', text: tags.join(' · ') }) : null,
    el('div', { class: 'card__foot' }, [
      mvpPrimary(mvp, file, platform, title),
      demo ? externalLink(demo, 'Watch demo', 'btn btn--ghost', actionLabel('Watch demo', title)) : null,
      copyButton({ label: 'Copy link', text: target, message: 'Link copied', ariaLabel: actionLabel('Copy link', title) }),
    ]),
  ]);
  if (file) enableDragDownload(card, file);
  return card;
}

/** What "Copy for Claude Code" copies. The skill's name goes in only if it is a plain folder name. */
function installHint(skill) {
  const name = safeSkillName(skill.name);
  const folder = name || 'skill-folder';
  const prompt = text(skill.examplePrompt);
  return [
    `Install ${name ? `the Claude skill "${name}"` : 'this Claude skill'}: unzip it into ~/.claude/skills/${folder}/ (all projects) or .claude/skills/${folder}/ (one repo).`,
    prompt ? `Then try: ${prompt}` : '',
  ].filter(Boolean).join('\n');
}

export function skillCard(skill, { detail = false } = {}) {
  const file = sitePath(skill.download, 'downloads/');
  const prompt = text(skill.examplePrompt);
  const title = text(skill.title) || text(skill.name) || 'Untitled skill';
  const card = el('article', { class: 'card surface', id: cardId(skill.id) }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Labels' }, [
      el('li', {}, el('span', { class: 'tag tag--b', text: 'Claude skill' })),
      skill.sample ? el('li', {}, el('span', { class: 'tag', text: 'Sample' })) : null,
    ]),
    el('h3', { text: title }),
    el('p', { text: text(skill.description) }),
    prompt ? el('p', { class: 'card__label', text: 'Example prompt' }) : null,
    prompt ? el('p', { class: 'mono code-block', text: prompt }) : null,
    detail ? facts([['Version', text(skill.version)], ['Built by', text(skill.builtBy)]]) : null,
    el('div', { class: 'card__foot' }, [
      file ? downloadLink(file, title) : el('span', { class: 'btn-note', text: 'Download coming soon' }),
      copyButton({
        label: 'Copy for Claude Code',
        text: () => installHint(skill),
        message: 'Copied for Claude Code',
        ariaLabel: actionLabel('Copy for Claude Code', title),
      }),
    ]),
  ]);
  if (file) enableDragDownload(card, file);
  return card;
}

/**
 * Marks and focuses the card the URL hash points at, for a card list that is built after the page has loaded (the
 * browser's own :target only works for elements that exist at load). Returns the card, or null if the hash names
 * nothing on the page. `.is-target` gets the same highlight as :target (catalog.css). A hash that is not valid
 * percent-encoding names nothing.
 */
export function focusTarget() {
  for (const old of document.querySelectorAll('.is-target')) old.classList.remove('is-target');
  let id = '';
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return null;
  }
  const card = id ? document.getElementById(id) : null;
  if (!card || !card.classList.contains('card')) return null;
  card.classList.add('is-target');
  card.setAttribute('tabindex', '-1');
  card.focus({ preventScroll: true });
  card.scrollIntoView({ block: 'center' });
  return card;
}

const initialsOf = (name) => (text(name) || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export function builderCard(builder, config) {
  const photo = sitePath(builder.photo);
  const href = attempt(() => userHref(config, builder.slackUserId));
  const name = text(builder.name) || 'Builder';
  const avatar = el('span', { class: 'avatar', 'aria-hidden': 'true' },
    photo ? el('img', { src: photo, alt: '', width: '44', height: '44', loading: 'lazy' }) : text(builder.initials) || initialsOf(builder.name));
  return el('article', { class: 'card surface' }, [
    el('div', { class: 'person' }, [
      avatar,
      el('div', {}, [el('h3', { text: name }), el('p', { class: 'card__meta', text: text(builder.role) })]),
    ]),
    text(builder.blurb) ? el('p', { text: text(builder.blurb) }) : null,
    href ? el('div', { class: 'card__foot' }, el('a', {
      class: 'btn btn--ghost', href, text: 'Message on Slack', 'aria-label': actionLabel('Message on Slack', name),
    })) : null,
  ]);
}
