/*
 * thinkle.js. The Thinkle page: hands keyboard focus to the game's frame so typing works at once, and shows a link to the
 * stand-alone page if the frame fails to load. The game (thinkle/game.html) is the same file for every visitor and runs
 * entirely in the browser: its stats live in that frame's own storage, and nothing is sent anywhere.
 */
const frame = document.querySelector('[data-thinkle-frame]');
const fallback = document.querySelector('[data-thinkle-fallback]');
const focusButton = document.querySelector('[data-thinkle-focus]');

function focusGame() {
  try {
    frame.contentWindow.focus();
  } catch {
    frame.focus();
  }
}

if (frame) {
  frame.addEventListener('load', () => {
    // A missing file still "loads" (the host's 404 page), so look at what arrived.
    try {
      const doc = frame.contentDocument;
      if (doc && !doc.querySelector('#app, [data-thinkle], .app')) fallback.hidden = false;
    } catch {
      // Cross-origin or blocked: leave it alone.
    }
  });
  frame.addEventListener('error', () => { fallback.hidden = false; });
  if (focusButton) focusButton.addEventListener('click', focusGame);
}
