/*
 * filters.js (frontend-builder A). The catalog filters: pure state logic (query string in, query string out,
 * which MVPs match) and the labelled form that edits that state.
 *
 * State is { q, type, status, tag }, kept in the query string (catalog.html?type=skill&status=live&tag=Data&q=brief).
 * Unknown values are ignored, so a stale or mistyped link still opens the full catalog.
 */
import { el, list, labelOf } from './dom.js';
import { TYPE_LABEL, STATUS_LABEL } from './home-cards.js';

export const NO_FILTERS = Object.freeze({ q: '', type: '', status: '', tag: '' });
const TYPE_ORDER = ['code', 'platform', 'skill', 'file'];
const STATUS_ORDER = ['idea', 'building', 'live', 'retired'];
const KEYS = ['type', 'status', 'tag', 'q'];

/** An MVP's topic tags. */
export function tagsOf(mvp) {
  return list(mvp.tags);
}

/** The values the data actually uses, in a fixed order for type and status and alphabetical for tags. */
export function facetsOf(mvps) {
  const tags = new Map();
  for (const mvp of mvps) for (const tag of tagsOf(mvp)) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  return {
    types: TYPE_ORDER.filter((value) => mvps.some((mvp) => mvp.type === value)),
    statuses: STATUS_ORDER.filter((value) => mvps.some((mvp) => mvp.status === value)),
    tags: [...tags.values()].sort((a, b) => a.localeCompare(b)),
  };
}

/** Reads a query string into a state; anything that is not one of the facet values is dropped. */
export function readState(search, facets) {
  const params = new URLSearchParams(search);
  const get = (name) => (params.get(name) || '').trim();
  const tagParam = get('tag').toLowerCase();
  return {
    q: get('q').replace(/\s+/g, ' ').slice(0, 100),
    type: facets.types.includes(get('type')) ? get('type') : '',
    status: facets.statuses.includes(get('status')) ? get('status') : '',
    tag: facets.tags.find((tag) => tag.toLowerCase() === tagParam) || '',
  };
}

/** The query string for a state ('' when nothing is set), type then status then tag then q. */
export function toSearch(state) {
  const params = new URLSearchParams();
  for (const key of KEYS) if (state[key]) params.set(key, state[key]);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const isFiltered = (state) => KEYS.some((key) => Boolean(state[key]));

const searchText = (mvp) => [mvp.title, mvp.problem, mvp.ideaOwner, labelOf(TYPE_LABEL, mvp.type), labelOf(STATUS_LABEL, mvp.status), ...tagsOf(mvp)]
  .filter((part) => typeof part === 'string').join(' ').toLowerCase();

/** MVPs that match every set filter; every word of the search must appear somewhere in the card's text. */
export function applyFilters(mvps, state) {
  const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const tag = state.tag.toLowerCase();
  return mvps.filter((mvp) => (!state.type || mvp.type === state.type)
    && (!state.status || mvp.status === state.status)
    && (!tag || tagsOf(mvp).some((item) => item.toLowerCase() === tag))
    && (!words.length || words.every((word) => searchText(mvp).includes(word))));
}

function field(id, label, control, className = '') {
  return el('div', { class: `field ${className}`.trim() }, [el('label', { for: id, text: label }), control]);
}

function select(id, name, allLabel, options, value) {
  const node = el('select', { id, name }, [
    el('option', { value: '', text: allLabel }),
    ...options.map(([optionValue, label]) => el('option', { value: optionValue, text: label })),
  ]);
  node.value = value;
  return node;
}

/**
 * The filter form. It is built once and never replaced, so typing and keyboard focus survive every change; only
 * the results below it are redrawn. onChange(state) runs when a select changes, and 200 ms after the last
 * keystroke in the search box. Returns { form, get(), set(state), focusSearch() }.
 */
export function filterBar(facets, state, onChange) {
  const search = el('input', { type: 'search', id: 'f-q', name: 'q', autocomplete: 'off', placeholder: 'Title, problem or tag', maxlength: '100' });
  const type = select('f-type', 'type', 'All types', facets.types.map((v) => [v, labelOf(TYPE_LABEL, v, v)]), state.type);
  const status = select('f-status', 'status', 'All statuses', facets.statuses.map((v) => [v, labelOf(STATUS_LABEL, v, v)]), state.status);
  const tag = select('f-tag', 'tag', 'All tags', facets.tags.map((v) => [v, v]), state.tag);
  search.value = state.q;

  const form = el('form', { class: 'filters surface', role: 'search', 'aria-label': 'Filter the catalog', novalidate: true }, [
    field('f-q', 'Search', search, 'field--search'),
    field('f-type', 'Type', type),
    field('f-status', 'Status', status),
    field('f-tag', 'Tag', tag, 'field--tag'),
  ]);

  const get = () => ({ q: search.value.replace(/\s+/g, ' ').trim(), type: type.value, status: status.value, tag: tag.value });
  const keyOf = (value) => JSON.stringify(KEYS.map((key) => value[key]));
  let last = keyOf(state);
  let timer = 0;
  // Only a real change is reported. Leaving the search box fires "change" after the typing was already reported, and
  // redrawing the results then would replace a button (such as "Clear filters") between mouse down and mouse up.
  const emit = () => {
    window.clearTimeout(timer);
    const next = get();
    if (keyOf(next) === last) return;
    last = keyOf(next);
    onChange(next);
  };
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('change', emit);
  search.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(emit, 200);
  });

  return {
    form,
    get,
    set(next) {
      window.clearTimeout(timer);
      last = keyOf(next);
      search.value = next.q;
      type.value = next.type;
      status.value = next.status;
      tag.value = next.tag;
    },
    focusSearch: () => search.focus(),
  };
}
