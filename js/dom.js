/*
 * dom.js (frontend-builder). Tiny helper so pages build elements with createElement and textContent only:
 * data from JSON never goes through innerHTML.
 *   el('a', { class: 'btn', href: 'x.html', text: 'Go' }, [child, 'text'])
 * Attribute values of null, undefined or false are skipped; true sets an empty attribute.
 * Also the small readers every page script needs for untrusted data: slot, text, list and labelOf.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = String(value);
    else if (key === 'class') node.className = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

function append(node, children) {
  const items = Array.isArray(children) ? children : [children];
  for (const child of items) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** The element a page marks with data-slot="name", or null. */
export const slot = (name) => document.querySelector(`[data-slot="${name}"]`);

/** A string from the data, trimmed; anything that is not a string gives ''. */
export const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The non-empty strings in an array from the data, trimmed; anything that is not an array gives []. */
export const list = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

/** Runs fn and returns what it returns, or `fallback` if it throws (for example encodeURIComponent on a bad string). */
export function attempt(fn, fallback = '') {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** map[key] for a key from the data, but only if the map has it as its own entry ('constructor' finds nothing). */
export const labelOf = (map, key, fallback = '') => (
  map && typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : fallback
);
