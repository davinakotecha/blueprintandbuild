/*
 * mode.js (frontend-builder). The Standard / Owen / Davina toggle.
 *
 * init(host) fills `host` with two controls that share one state:
 *   - a radio group (from 48rem): arrow keys move and select, Home and End jump, roving tabindex;
 *   - one button (phones): cycles to the next mode.
 * layout.css shows one and hides the other. A polite live region announces each change.
 *
 * Changing mode (INTERFACES.md, "Mode switch"): import ./switch-<to>.js and call play({ from, to, origin, tier, apply }).
 * apply() sets data-mode, saves 'bb-mode' and fires bb:modechange on document; it runs once, and if the
 * import or play fails (or hangs) this module calls it. One switch at a time: input during a switch is ignored.
 */
import { el } from './dom.js';

const MODES = ['standard', 'owen', 'davina'];
const LABELS = { standard: 'Standard', owen: 'Owen', davina: 'Davina' };
const WATCHDOG_MS = 3000;
const GIVE_UP_MS = 8000;

let busy = false;
const views = [];

export const getMode = () => {
  const mode = document.documentElement.dataset.mode;
  return MODES.includes(mode) ? mode : 'standard';
};

const nextMode = (mode) => MODES[(MODES.indexOf(mode) + 1) % MODES.length];

async function currentTier() {
  try {
    const tier = await import('./tier.js');
    return tier.getTier();
  } catch {
    return 'static';
  }
}

function save(mode) {
  try {
    window.localStorage.setItem('bb-mode', mode);
  } catch {
    // Storage blocked: the mode lasts for this page only.
  }
}

function centreOf(node) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Change to `to`. `from` is the control the visitor used (its centre is where the animation starts). */
export async function setMode(to, control) {
  const before = getMode();
  if (!MODES.includes(to) || to === before || busy) return;
  busy = true;
  views.forEach((view) => view.sync(to));

  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    document.documentElement.dataset.mode = to;
    save(to);
    views.forEach((view) => view.say(`${LABELS[to]} mode on.`));
    document.dispatchEvent(new CustomEvent('bb:modechange', { detail: { mode: to, from: before } }));
  };

  const origin = centreOf(control || document.body);
  // ?frames=1 makes a switch module pause itself for preview stills: no timers then, or apply() would fire early.
  // Honoured on localhost only, as in the switch modules, so a link with ?frames=1 cannot freeze the live site.
  const local = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const paused = local && new URLSearchParams(window.location.search).get('frames') === '1';
  const watchdog = paused ? 0 : window.setTimeout(apply, WATCHDOG_MS);
  try {
    const tier = await currentTier();
    const module = await import(`./switch-${to}.js`);
    const running = module.play({ from: before, to, origin, tier, apply });
    await (paused ? running : Promise.race([running, new Promise((resolve) => window.setTimeout(resolve, GIVE_UP_MS))]));
  } catch {
    // The animation file is missing or threw: the switch still happens, without the show.
  }
  window.clearTimeout(watchdog);
  apply();
  busy = false;
}

function radioGroup() {
  const group = el('div', { class: 'mode-radios', role: 'radiogroup', 'aria-label': 'Colour mode' });
  const radios = MODES.map((mode) => el('button', {
    type: 'button', role: 'radio', class: 'mode-radio', 'data-mode-value': mode, 'aria-checked': 'false', tabindex: '-1', text: LABELS[mode],
  }));
  group.append(...radios);

  const sync = (mode) => radios.forEach((radio) => {
    const on = radio.dataset.modeValue === mode;
    radio.setAttribute('aria-checked', String(on));
    radio.tabIndex = on ? 0 : -1;
  });

  group.addEventListener('click', (event) => {
    const radio = event.target.closest('[role="radio"]');
    if (radio) setMode(radio.dataset.modeValue, radio);
  });

  group.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const at = radios.indexOf(document.activeElement);
    if (at < 0) return;
    let target = -1;
    if (event.key in keys) target = (at + keys[event.key] + radios.length) % radios.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = radios.length - 1;
    if (target < 0) return;
    event.preventDefault();
    if (busy) return;
    radios[target].focus();
    setMode(radios[target].dataset.modeValue, radios[target]);
  });
  return { node: group, sync };
}

function cycleButton() {
  const name = el('span', { class: 'mode-cycle__name' });
  const hint = el('span', { class: 'sr-only' });
  const button = el('button', { type: 'button', class: 'mode-cycle' }, [el('span', { class: 'mode-cycle__dot', 'aria-hidden': 'true' }), name, hint]);
  const sync = (mode) => {
    name.textContent = LABELS[mode];
    hint.textContent = ` mode. Activate to switch to ${LABELS[nextMode(mode)]}.`;
  };
  button.addEventListener('click', () => setMode(nextMode(getMode()), button));
  return { node: button, sync };
}

export function init(host) {
  if (!host || host.dataset.ready) return;
  host.dataset.ready = 'true';
  const radios = radioGroup();
  const cycle = cycleButton();
  const live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  host.append(radios.node, cycle.node, live);

  const view = {
    sync: (mode) => { radios.sync(mode); cycle.sync(mode); },
    say: (message) => { live.textContent = ''; window.setTimeout(() => { live.textContent = message; }, 50); },
  };
  views.push(view);
  view.sync(getMode());
}
