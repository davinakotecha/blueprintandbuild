/*
 * content.js (frontend-builder). Every page reads its content through getData(name), which fetches
 * site/data/<name>.json. The URL is resolved against this file, so it works from any page and any sub-path.
 * Resolves to the parsed JSON, or null if the file is missing, not JSON, or the name is not a plain file name.
 * Results are cached by name (the promise, so two callers share one request).
 */
const cache = new Map();

async function load(name) {
  try {
    const response = await fetch(new URL(`../data/${name}.json`, import.meta.url));
    if (!response.ok) return null;
    const data = await response.json();
    return data === undefined ? null : data;
  } catch {
    return null;
  }
}

export function getData(name) {
  if (typeof name !== 'string' || !/^[a-z0-9-]+$/i.test(name)) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, load(name));
  return cache.get(name);
}
