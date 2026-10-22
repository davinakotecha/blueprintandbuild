/*
 * home-cards.js (frontend-builder). The card builders for Home: latest MVPs, Claude skills, builders, and the
 * placeholder shown when a list is missing. All DOM comes from createElement and textContent (via dom.js);
 * data never goes through innerHTML. Outbound links must be http(s) and downloads and photos must be relative
 * paths on this site; anything else is treated as "not set" and the element is left out.
 */
import { el } from './dom.js';
import { copyButton } from './clipboard.js';
import { enableDragDownload } from './drag.js';

const TYPE_LABEL = { code: 'Code', platform: 'Platform', skill: 'Claude skill', file: 'File' };
const STATUS_LABEL = { idea: 'Idea', building: 'Building', live: 'Live', retired: 'Retired' };

const absolute = (href) => new URL(href, window.location.href).href;
const text = (value) => (typeof value === 'string' ? value.trim() : '');

function webUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * A same-origin relative path (a download or a photo from the data files), or '' if it is anything else:
 * no scheme, no leading slash (so no `//host`), no backslash, no control characters, no `..` segment (also when
 * percent-encoded). `prefix`, when given, is the folder it must start with. The result must resolve to this origin.
 */
function sitePath(value, prefix = '') {
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

const downloadLabel = (file) => (file.toLowerCase().endsWith('.zip') ? 'Download .zip' : 'Download');
const downloadLink = (file) => el('a', { class: 'btn', href: file, download: '', text: downloadLabel(file) });

function mvpPrimary(mvp, file, platform) {
  if (mvp.type === 'platform') {
    if (!platform) return el('span', { class: 'btn-note', text: 'Link coming soon' });
    return el('a', { class: 'btn', href: platform, target: '_blank', rel: 'noopener noreferrer' }, [
      'Open', el('span', { class: 'sr-only', text: ' (opens in a new tab)' }),
    ]);
  }
  return file ? downloadLink(file) : el('span', { class: 'btn-note', text: 'Link coming soon' });
}

export function mvpCard(mvp) {
  const file = sitePath(mvp.download, 'downloads/');
  const platform = webUrl(mvp.links && mvp.links.platform);
  const tags = Array.isArray(mvp.tags) ? mvp.tags.filter((tag) => typeof tag === 'string' && tag) : [];
  const target = platform || (file ? absolute(file) : absolute(`catalog.html#${encodeURIComponent(mvp.id || '')}`));

  const card = el('article', { class: 'card surface' }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Status and type' }, [
      el('li', {}, el('span', { class: 'tag', text: STATUS_LABEL[mvp.status] || 'MVP' })),
      el('li', {}, el('span', { class: 'tag tag--b', text: TYPE_LABEL[mvp.type] || 'MVP' })),
    ]),
    el('h3', { text: mvp.title || 'Untitled MVP' }),
    el('p', { text: mvp.problem || '' }),
    tags.length ? el('p', { class: 'card__meta', text: tags.join(' · ') }) : null,
    el('div', { class: 'card__foot' }, [
      mvpPrimary(mvp, file, platform),
      copyButton({ label: 'Copy link', text: target, message: 'Link copied' }),
    ]),
  ]);
  if (file) enableDragDownload(card, file);
  return card;
}

const installHint = (skill) => [
  `Install the Claude skill "${skill.name}": unzip it into ~/.claude/skills/${skill.name}/ (all projects) or .claude/skills/${skill.name}/ (one repo).`,
  skill.examplePrompt ? `Then try: ${skill.examplePrompt}` : '',
].filter(Boolean).join('\n');

export function skillCard(skill) {
  const file = sitePath(skill.download, 'downloads/');
  const prompt = text(skill.examplePrompt);
  const card = el('article', { class: 'card surface' }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Labels' }, [
      el('li', {}, el('span', { class: 'tag tag--b', text: 'Claude skill' })),
      skill.sample ? el('li', {}, el('span', { class: 'tag', text: 'Sample' })) : null,
    ]),
    el('h3', { text: skill.title || skill.name || 'Untitled skill' }),
    el('p', { text: skill.description || '' }),
    prompt ? el('p', { class: 'card__label', text: 'Example prompt' }) : null,
    prompt ? el('p', { class: 'mono code-block', text: prompt }) : null,
    el('div', { class: 'card__foot' }, [
      file ? downloadLink(file) : el('span', { class: 'btn-note', text: 'Download coming soon' }),
      copyButton({ label: 'Copy for Claude Code', text: () => installHint(skill), message: 'Copied for Claude Code' }),
    ]),
  ]);
  if (file) enableDragDownload(card, file);
  return card;
}

function slackHref(config, builder) {
  const slack = config && config.slack;
  if (!config || !config.features || config.features.slackLinks !== true) return '';
  if (!slack || !slack.teamId || !builder.slackUserId) return '';
  return `slack://user?team=${encodeURIComponent(slack.teamId)}&id=${encodeURIComponent(builder.slackUserId)}`;
}

const initialsOf = (name) => String(name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export function builderCard(builder, config) {
  const photo = sitePath(builder.photo);
  const href = slackHref(config, builder);
  const avatar = el('span', { class: 'avatar', 'aria-hidden': 'true' },
    photo ? el('img', { src: photo, alt: '', width: '44', height: '44', loading: 'lazy' }) : text(builder.initials) || initialsOf(builder.name));
  return el('article', { class: 'card surface' }, [
    el('div', { class: 'person' }, [
      avatar,
      el('div', {}, [el('h3', { text: builder.name || 'Builder' }), el('p', { class: 'card__meta', text: builder.role || '' })]),
    ]),
    builder.blurb ? el('p', { text: builder.blurb }) : null,
    href ? el('div', { class: 'card__foot' }, el('a', { class: 'btn btn--ghost', href, text: 'Message on Slack' })) : null,
  ]);
}
