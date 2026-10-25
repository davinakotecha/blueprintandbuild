/*
 * palette-search.js (frontend-builder B). The search index and ranking for the palette, with no DOM in it.
 * An entry is { title, href, kind, description, tags, order }. Matching is case-insensitive over title, tags and
 * description; every word typed must match somewhere. Titles that start with the query rank first, then titles
 * that contain every word, then tags, then descriptions; ties keep pages before MVPs before skills.
 */
const KIND_ORDER = { Page: 0, MVP: 1, Skill: 2 };

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const list = (value) => (Array.isArray(value) ? value : []);

/** encodeURIComponent that gives '' instead of throwing (a lone surrogate in an id makes it throw). */
function encode(value) {
  try {
    return encodeURIComponent(value);
  } catch {
    return '';
  }
}

function entry(title, href, kind, description, tags, order) {
  return {
    title, href, kind, description, tags, order,
    lowTitle: title.toLowerCase(),
    lowTags: tags.join(' ').toLowerCase(),
    lowDesc: description.toLowerCase(),
  };
}

/** Pages from nav-data.js, then MVPs (to catalog.html#id) and skills (to skills.html#id) from the data files. */
export function buildIndex(pages, mvps, skills) {
  const out = list(pages).map((page, i) => entry(page.title, page.href, 'Page', page.description || '', list(page.tags), i));
  // One bad entry is skipped; it must never take the others out of the search.
  list(mvps).forEach((mvp, i) => {
    if (!mvp || !str(mvp.id) || !str(mvp.title)) return;
    const id = encode(str(mvp.id));
    if (!id) return;
    const tags = [...list(mvp.tags).filter((tag) => typeof tag === 'string'), str(mvp.type), str(mvp.status)].filter(Boolean);
    out.push(entry(mvp.title, `catalog.html#${id}`, mvp.sample ? 'MVP (sample)' : 'MVP', str(mvp.problem), tags, i));
  });
  list(skills).forEach((skill, i) => {
    const title = str(skill && (skill.title || skill.name));
    if (!skill || !str(skill.id) || !title) return;
    const id = encode(str(skill.id));
    if (!id) return;
    const tags = [str(skill.name), 'skill', 'claude'].filter(Boolean);
    out.push(entry(title, `skills.html#${id}`, skill.sample ? 'Skill (sample)' : 'Skill', str(skill.description), tags, i));
  });
  return out;
}

function score(item, query, words) {
  if (item.lowTitle.startsWith(query)) return 0;
  const inTitle = (word) => item.lowTitle.includes(word);
  if (words.every(inTitle)) return 1;
  const inTags = (word) => inTitle(word) || item.lowTags.includes(word);
  if (words.every(inTags)) return 2;
  if (words.every((word) => inTags(word) || item.lowDesc.includes(word))) return 3;
  return -1;
}

/** At most `max` entries for `text`. An empty query lists the pages. */
export function rank(index, text, max) {
  const query = str(text).toLowerCase().replace(/\s+/g, ' ');
  if (!query) return index.filter((item) => item.kind === 'Page').slice(0, max);
  const words = query.split(' ');
  return index
    .map((item) => ({ item, s: score(item, query, words) }))
    .filter(({ s }) => s >= 0)
    .sort((a, b) => a.s - b.s
      || (KIND_ORDER[a.item.kind.split(' ')[0]] - KIND_ORDER[b.item.kind.split(' ')[0]])
      || a.item.order - b.item.order)
    .slice(0, max)
    .map(({ item }) => item);
}
