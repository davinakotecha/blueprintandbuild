/*
 * cycles.js. Works out where the programme is today from data/cycles.json (the calendar scripts/cycles.mjs writes).
 * Pure functions with no DOM and no clock: callers pass today as an ISO date (YYYY-MM-DD), so the content build can
 * use the same code in Node, and a test can ask what the site would show on any day. A cycle is
 * { cycle, title, start, drop, phases: [vote, scope, build] }; ideas are always open, so they are not a phase.
 * Nothing here throws: malformed entries are skipped, and no usable calendar gives state 'none'.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const usable = (c) => Boolean(c && typeof c === 'object' && ISO.test(c.start) && ISO.test(c.drop) && Array.isArray(c.phases)
  && c.phases.length > 0 && c.phases.every((p) => p && ISO.test(p.start) && ISO.test(p.end)));

/** The calendar's usable cycles, in date order. */
export const cycleList = (cycles) => (Array.isArray(cycles) ? cycles.filter(usable) : []);

/** Today as a local ISO date. */
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Where the programme is on `today`.
 *   state 'active'    a cycle is running: cycle, phase (the last phase that has started) and its position
 *   state 'upcoming'  before the first cycle, or in the gap before the next one: cycle is the next to start, phase null
 *   state 'after'     past the end of the calendar: cycle null
 *   state 'none'      no usable calendar
 * `next` is the cycle after `cycle` (or null), and `dropCycle` is the cycle whose MVP Drop comes next (today counts).
 */
export function locate(cycles, today) {
  const list = cycleList(cycles);
  if (!list.length) return { state: 'none', cycle: null, phase: null, index: -1, next: null, dropCycle: null };
  const index = list.findIndex((c) => today <= c.drop);
  if (index === -1) return { state: 'after', cycle: null, phase: null, index: -1, next: null, dropCycle: null };
  const cycle = list[index];
  const base = { cycle, index, next: list[index + 1] || null, dropCycle: cycle };
  if (today < cycle.start) return { ...base, state: 'upcoming', phase: null };
  const phase = [...cycle.phases].reverse().find((p) => p.start <= today) || cycle.phases[0];
  return { ...base, state: 'active', phase };
}

/**
 * The vote the visitor is looking for: the first vote that has not closed yet. When the vote of the cycle that is
 * running has closed, `closed` is that cycle, so a page can say "Cycle 1 voting has closed; Cycle 2 opens ...".
 * Returns { cycle, phase, closed } or null when there is nothing to show.
 */
export function voteWindow(cycles, today) {
  const list = cycleList(cycles);
  if (!list.length) return null;
  const vote = (c) => c.phases.find((p) => p.id === 'vote') || c.phases[0];
  const index = list.findIndex((c) => today <= vote(c).end);
  if (index === -1) return { cycle: list.at(-1), phase: vote(list.at(-1)), closed: list.at(-1) };
  const closed = index > 0 && today <= list[index - 1].drop ? list[index - 1] : null;
  return { cycle: list[index], phase: vote(list[index]), closed };
}
