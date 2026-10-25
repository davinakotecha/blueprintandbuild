/*
 * catalog.js (frontend-builder A). The MVP catalog: reads mvps.json, builds the filter bar once, and redraws the
 * grid of cards when a filter changes. State lives in the query string (filters.js), so a filtered view can be
 * shared and survives a reload. The filter controls are never replaced, so keyboard focus stays where it was; the
 * result count is announced through a polite live region. A missing or empty mvps.json gives one placeholder card,
 * and one malformed entry is skipped instead of blanking the page.
 */
import { getData } from './content.js';
import { el, slot } from './dom.js';
import { mvpCard, placeholderCard, focusTarget } from './home-cards.js';
import { buildCards, fillList, hasSample, revealSampleNote } from './lists.js';
import {
  NO_FILTERS, facetsOf, readState, toSearch, isFiltered, applyFilters, filterBar,
} from './filters.js';

function summary(shown, total, filtered) {
  const noun = (n) => `${n} ${n === 1 ? 'MVP' : 'MVPs'}`;
  if (!filtered) return total === 1 ? 'Showing 1 MVP' : `Showing all ${noun(total)}`;
  return `Showing ${shown} of ${noun(total)}`;
}

function emptyState(onClear) {
  const clear = el('button', { type: 'button', class: 'btn', text: 'Clear filters' });
  clear.addEventListener('click', onClear);
  return el('div', { class: 'card surface empty-state' }, [
    el('h3', { text: 'No MVPs match these filters' }),
    el('p', { text: 'Try fewer filters, or a different search word.' }),
    el('div', { class: 'card__foot' }, clear),
  ]);
}

const noMvps = () => placeholderCard('MVPs are on the way', 'The first MVP lands at the end of the Build month. Until then, send in an idea.');

/**
 * Keeps the address bar in step with the filters. The new address is relative to the current one (./catalog.html?...),
 * so it can never leave this origin, even for a path such as //catalog.html (which a bare pathname would turn into a
 * link to another host). If the browser refuses, the filters still work; only the address stays as it was.
 */
function remember(state) {
  try {
    const url = new URL(window.location.href);
    const last = url.pathname.split('/').pop();
    url.search = toSearch(state);
    window.history.replaceState(null, '', `./${last}${url.search}${url.hash}`);
  } catch {
    // Not fatal: the visible filters and results are already up to date.
  }
}

async function start() {
  const results = slot('results');
  const filtersHost = slot('filters');
  const count = document.querySelector('[data-count]');
  const clearButton = document.querySelector('[data-clear]');
  results.replaceChildren(el('p', { class: 'placeholder-note', text: 'Loading MVPs…' }));

  const data = await getData('mvps');
  const pairs = buildCards(data, (mvp) => mvpCard(mvp, { detail: true }));
  const mvps = pairs.map(([mvp]) => mvp);
  if (!mvps.length) {
    filtersHost.hidden = true;
    count.textContent = '';
    fillList(results, [], null, noMvps);
    return;
  }
  revealSampleNote('mvps', hasSample(mvps));

  const facets = facetsOf(mvps);
  const cards = new Map(pairs);
  let state = readState(window.location.search, facets);

  const render = () => {
    const shown = applyFilters(mvps, state);
    const filtered = isFiltered(state);
    count.textContent = summary(shown.length, mvps.length, filtered);
    clearButton.hidden = !filtered || !shown.length;
    results.replaceChildren(...(shown.length ? shown.map((mvp) => cards.get(mvp)) : [emptyState(clear)]));
  };

  const bar = filterBar(facets, state, (next) => {
    state = next;
    remember(state);
    render();
  });

  function clear() {
    state = { ...NO_FILTERS };
    bar.set(state);
    remember(state);
    render();
    bar.focusSearch();
  }

  // A link to one MVP (catalog.html#id) must show it, whatever the filters are.
  const showHash = () => {
    let id = '';
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return; // A hash that is not valid percent-encoding names nothing; leave the page as it is.
    }
    const wanted = mvps.find((mvp) => mvp.id === id);
    if (wanted && !applyFilters(mvps, state).includes(wanted)) {
      state = { ...NO_FILTERS };
      bar.set(state);
      render();
    }
    focusTarget();
  };

  clearButton.addEventListener('click', clear);
  filtersHost.append(bar.form);
  window.addEventListener('popstate', () => {
    state = readState(window.location.search, facets);
    bar.set(state);
    render();
  });
  window.addEventListener('hashchange', showHash);

  render();
  if (window.location.hash) showHash();
}

start();
