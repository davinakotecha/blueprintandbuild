/*
 * clipboard.js (frontend-builder). Copy to the clipboard with a fallback, and say so to screen readers.
 *   copyText(text)        -> Promise<boolean>   Clipboard API, else a hidden textarea and execCommand
 *   announce(message)     polite live region shared by every "Copied" message
 *   copyButton({...})     a button that copies and shows "Copied" for two seconds
 */
import { el } from './dom.js';

let region = null;

export function announce(message) {
  if (!region) {
    region = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}

function legacyCopy(text) {
  const previous = document.activeElement;
  const area = el('textarea', { class: 'sr-only', readonly: true, tabindex: '-1', 'aria-hidden': 'true' });
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (previous && previous.focus) previous.focus();
  return ok;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused: use the fallback below.
  }
  return legacyCopy(text);
}

/** text may be a string or a function that returns one (read at click time). */
export function copyButton({ label, text, message = 'Copied', className = 'btn btn--ghost' }) {
  const button = el('button', { type: 'button', class: className, text: label });
  let timer = 0;
  button.addEventListener('click', async () => {
    const ok = await copyText(typeof text === 'function' ? text() : text);
    button.textContent = ok ? 'Copied' : 'Copy failed';
    announce(ok ? message : 'Could not copy. Select the text and copy it by hand.');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.textContent = label;
    }, 2000);
  });
  return button;
}
