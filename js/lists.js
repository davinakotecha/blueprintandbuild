/*
 * lists.js. The two things every card page did the same way: fill a card list (or show a placeholder when there is
 * nothing to show) and reveal the "these are samples" note. One bad entry in the data never blanks the list: each
 * card is built on its own, and an entry whose card throws is left out.
 */
/**
 * Builds a card for each object in items, skipping anything that is not an object or whose builder throws.
 * buildCard(item, position) gets the position among the cards kept so far (so "Idea A, B, C" stays in a row even
 * when an entry is skipped). Returns [[item, card], ...]; stops after `limit` cards when a limit is given.
 */
export function buildCards(items, buildCard, limit = Infinity) {
  const pairs = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (pairs.length >= limit) break;
    if (!item || typeof item !== 'object') continue;
    try {
      const card = buildCard(item, pairs.length);
      if (card) pairs.push([item, card]);
    } catch {
      // A malformed entry is left out; the rest of the list still shows.
    }
  }
  return pairs;
}

/**
 * Puts a card for each item in host and sets data-count (the CSS uses it so a short list fills its row). With no
 * cards it shows placeholder() (a function that returns a node) and a count of 1, or nothing at all if there is no
 * placeholder. Returns the items that got a card (so a page can ask whether any of them is a sample).
 */
export function fillList(host, items, buildCard, placeholder, limit = Infinity) {
  if (!host) return [];
  const pairs = buildCards(items, buildCard, limit);
  const cards = pairs.map(([, card]) => card);
  if (cards.length) {
    host.dataset.count = String(cards.length);
    host.replaceChildren(...cards);
  } else if (placeholder) {
    host.dataset.count = '1';
    host.replaceChildren(placeholder());
  } else {
    host.removeAttribute('data-count');
    host.replaceChildren();
  }
  return pairs.map(([item]) => item);
}

/** True if any entry in the list is flagged `sample: true`. */
export const hasSample = (items) => Array.isArray(items) && items.some((item) => Boolean(item && item.sample));

/**
 * Shows the page's "these are samples" note when any entry is a sample. The note is the element marked
 * data-sample-note; a page with more than one gives each a value (data-sample-note="results") and passes that as
 * slotName, otherwise slotName is ignored and the one note is used.
 */
export function revealSampleNote(slotName, anyIsSample) {
  if (!anyIsSample) return;
  const named = slotName ? document.querySelector(`[data-sample-note="${CSS.escape(slotName)}"]`) : null;
  const note = named || document.querySelector('[data-sample-note]');
  if (note) note.hidden = false;
}
