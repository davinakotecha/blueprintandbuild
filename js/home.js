/*
 * home.js (frontend-builder). Fills the Home page from site/data/*.json through content.js: the hero eyebrow,
 * the stats strip, the "This cycle" cards and the three card lists. Every list degrades to a short placeholder
 * card when its JSON is missing, and one malformed entry (a null in the shortlist, say) is skipped rather than
 * stopping the rest of the page. Where the programme is today (which cycle, which phase) is worked out here, in the
 * browser, from data/cycles.json and the date (cycles.js), so nothing has to be edited as the weeks go by.
 * DOM is built with createElement and textContent only.
 */
import { getData } from './content.js';
import { el, slot, text, labelOf, attempt } from './dom.js';
import { mvpCard, skillCard, builderCard, placeholderCard } from './home-cards.js';
import { shortDate, daysFromToday, clampDays, rangeText } from './dates.js';
import { buildCards, fillList } from './lists.js';
import { locate, todayIso } from './cycles.js';

const DASH = '—';
const STAGES = { blueprint: 'Blueprint', build: 'Build' };
const BLURB = {
  vote: 'The shortlist is set. Vote in Slack for 10 working days.',
  scope: 'The winning idea is being blueprinted with the person who sent it.',
  build: 'The MVP is being built, then played back to the practice at the MVP Drop.',
};

const objects = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);

function setStat(name, value) {
  const target = document.querySelector(`[data-stat="${name}"]`);
  if (target) target.textContent = Number.isFinite(value) ? String(value) : DASH;
}

function fillStats(stats, cycle, here) {
  setStat('mvpsShipped', stats && stats.mvpsShipped);
  setStat('skillsPublished', stats && stats.skillsPublished);
  setStat('ideasSubmitted', stats && Number.isFinite(stats.ideasSubmitted) ? stats.ideasSubmitted : cycle && cycle.ideasSubmitted);
  setStat('daysToDrop', here.dropCycle ? clampDays(daysFromToday(here.dropCycle.drop)) : null);
}

function fillEyebrow(here) {
  const eyebrow = document.querySelector('[data-hero-eyebrow]');
  if (!eyebrow) return;
  if (here.state === 'active') {
    const stage = labelOf(STAGES, here.phase.stage);
    eyebrow.textContent = `${text(here.cycle.title)} · ${stage || 'In progress'}`;
  } else if (here.state === 'upcoming') {
    eyebrow.textContent = `${text(here.cycle.title)} starts ${shortDate(here.cycle.start)} · Ideas open now`;
  } else {
    eyebrow.textContent = 'Ideas are always open';
  }
}

function phaseList(phases, currentIndex) {
  return el('ol', { class: 'phases', 'aria-label': 'Phases of this cycle' }, buildCards(phases, (phase) => {
    const index = phases.indexOf(phase);
    const here = index === currentIndex;
    const dates = rangeText(phase.start, phase.end);
    return el('li', {
      class: here ? 'is-on' : index < currentIndex ? 'is-done' : '',
      'aria-current': here ? 'step' : null,
    }, [
      text(phase.label),
      here ? el('span', { class: 'sr-only', text: ' (now)' }) : null,
      dates ? ' ' : null,
      dates ? el('span', { class: 'phase__dates', text: dates }) : null,
    ]);
  }).map(([, item]) => item));
}

function countLine(cycle) {
  const days = cycle ? clampDays(daysFromToday(cycle.drop)) : null;
  const drop = cycle ? shortDate(cycle.drop) : '';
  return el('p', { class: 'count' }, [
    el('span', { class: 'count__n', text: days === null ? DASH : String(days) }),
    el('span', { class: 'count__l', text: days === null ? 'Next MVP Drop date to be confirmed' : `days to the next MVP Drop${drop ? ` (${drop})` : ''}` }),
  ]);
}

function nowCard(here) {
  const { cycle } = here;
  const phases = objects(cycle.phases);
  const index = here.state === 'active' ? phases.indexOf(here.phase) : -1;
  if (here.state === 'upcoming') {
    return [
      el('span', { class: 'tag', text: 'Up next' }),
      el('h3', { text: `${text(cycle.title)} starts ${shortDate(cycle.start)}` }),
      el('p', { text: 'Ideas are always open, so send yours in now and it joins the backlog for the shortlist. The vote opens on the first day of the cycle and runs for 10 working days.' }),
      phaseList(phases, -1),
      countLine(cycle),
    ];
  }
  const phase = phases[index];
  const dates = phase ? rangeText(phase.start, phase.end) : '';
  return [
    el('span', { class: 'tag', text: 'Now' }),
    el('h3', { text: (phase && text(phase.label)) || text(cycle.title) || 'This cycle' }),
    el('p', { text: [labelOf(BLURB, phase && phase.id), dates ? `${dates}.` : ''].filter(Boolean).join(' ') }),
    phaseList(phases, index),
    countLine(cycle),
  ];
}

/** The shortlist for the cycle whose vote is next or running, from cycle.json (shortlists keyed by cycle number). */
function shortlistCard(cycle, here) {
  const target = here.cycle;
  const list = target && cycle && cycle.shortlists ? cycle.shortlists[String(target.cycle)] : null;
  const items = buildCards(list, (item, position) => el('li', { class: 'opt' }, [
    el('span', { text: text(item.title) || 'Untitled idea' }),
    el('span', { class: 'opt__label', text: `Idea ${String.fromCharCode(65 + position)}` }),
  ]), 3);
  const voting = here.state === 'active' && here.phase.id === 'vote';
  const opens = target ? shortDate(target.start) : '';
  return [
    el('span', { class: 'tag tag--b', text: 'Shortlist' }),
    el('h3', { text: voting ? 'Vote is open' : 'Vote opens soon' }),
    items.length
      ? el('ul', { class: 'opts' }, items.map(([, node]) => node))
      : el('p', { text: `The builders pick the top three from the backlog before each vote${opens ? `, and the next one opens on ${opens}` : ''}. Send an idea in and it is in the running.` }),
    el('div', { class: 'card__foot' }, el('a', { class: 'btn btn--ghost', href: 'vote.html', text: 'Go to the vote' })),
  ];
}

function fillCycle(cycle, here) {
  const now = slot('now');
  const shortlist = slot('shortlist');
  if (here.state === 'none' || here.state === 'after') {
    const message = here.state === 'after'
      ? 'The cycle calendar has run out. Ideas are still open: send yours in and it joins the backlog.'
      : 'Cycle details are not available right now. Check back soon.';
    now.replaceChildren(el('h3', { text: 'This cycle' }), el('p', { text: message }));
    shortlist.replaceChildren(el('h3', { text: 'Shortlist' }), el('p', { text: 'The shortlist is not available right now.' }));
    return;
  }
  now.replaceChildren(...nowCard(here));
  shortlist.replaceChildren(...shortlistCard(cycle, here));
}

/** Runs one part of the page on its own, so a failure in it cannot stop the parts after it (it keeps its "Loading" text). */
const guard = (part) => attempt(part);

async function start() {
  const [cycle, cycles, stats, mvps, skills, builders, config] = await Promise.all(
    ['cycle', 'cycles', 'stats', 'mvps', 'skills', 'builders', 'config'].map(getData),
  );
  const here = locate(cycles, todayIso());
  guard(() => fillEyebrow(here));
  guard(() => fillStats(stats, cycle, here));
  guard(() => fillCycle(cycle, here));
  guard(() => fillList(slot('mvps'), mvps, (mvp) => mvpCard(mvp), () => placeholderCard('MVPs are on the way', 'The first MVPs land at the end of the build stage. Until then, send in an idea.'), 3));
  guard(() => fillList(slot('skills'), skills, (skill) => skillCard(skill), () => placeholderCard('Skills are on the way', 'Practice skills will be listed here, each with a download and an example prompt.'), 3));
  guard(() => fillList(slot('builders'), builders, (builder) => builderCard(builder, config), () => placeholderCard('Builders', 'Builder details will appear here.'), 2));
}

start();
