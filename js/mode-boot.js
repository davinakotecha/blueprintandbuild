/*
 * mode-boot.js (frontend-builder). A CLASSIC script in the <head> of every page, so it runs before first paint.
 * It does one thing: set <html data-mode> from the saved choice (localStorage 'bb-mode'), else 'standard'.
 * It never throws: storage can be blocked (private mode, strict settings). mode.js owns everything else.
 */
(function () {
  const MODES = ['standard', 'owen', 'davina'];
  let mode = 'standard';
  try {
    const saved = window.localStorage.getItem('bb-mode');
    if (MODES.indexOf(saved) !== -1) mode = saved;
  } catch (error) {
    // Storage is blocked: keep Standard.
  }
  document.documentElement.setAttribute('data-mode', mode);
})();
