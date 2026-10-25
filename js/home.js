/*
 * home.js (frontend-builder). Fills the Home page from site/data/*.json through content.js: the hero eyebrow,
 * the stats strip, the "This cycle" cards and the three card lists. Every list degrades to a short placeholder
 * card when its JSON is missing, and one malformed entry (a null in the shortlist, say) is skipped rather than
 * stopping the rest of the page. Days to the next drop are worked out here, in the browser, from cycle.nextDrop.
 * DOM is built with createElement and textContent only.
 */
import { getData } from './content.js';
import { el, slot, text, labelOf, attempt } from './dom.js';
import { mvpCard, skillCard, builderCard, placeholderCard } from './home-cards.js';
import { shortDate, daysFromToday, clampDays, rangeText } from './dates.js';
import { buildCards, fillList } from './lists.js';

const DASH = '—';
const MONTHS = { blueprint: 'Month 1: Blueprint', build: 'Month 2: Build' };
const BLURB = {
  ideas: 'Ideas are open. Send yours in before the cut-off to make this shortlist.',
  triage: 'The builders are narrowing the ideas to a shortlist.',
  vote: 'The shortlist is set. Vote in Slack.',
  scope: 'The winning idea is being scoped with the person who sent it.',
  build: 'The MVP is being built, then played back to the practice.',
};

const objects = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);

function setStat(name, value, sample) {
  const target = document.querySelector(`[data-stat="${name}"]`);
  if (target) target.textContent = Number.isFinite(value) ? String(value) : DASH;
  const note = document.querySelector(`[data-stat-note="${name}"]`);
  if (note && sample) note.textContent = ' (sample)';
}

function fillStats(stats, cycle) {
  const sample = Boolean(stats && stats.includesSample);
  setStat('mvpsShipped', stats && stats.mvpsShipped, sample);
  setStat('skillsPublished', stats && stats.skillsPublished, sample);
  const ideas = stats && Number.isFinite(stats.ideasSubmitted) ? stats.ideasSubmitted : cycle && cycle.ideasSubmitted;
  setStat('ideasSubmitted', ideas);
  setStat('daysToDrop', cycle ? clampDays(daysFromToday(cycle.nextDrop)) : null);
}

function fillEyebrow(cycle) {
  const phase = cycle && Array.isArray(cycle.phases) ? objects(cycle.phases).find((item) => item.id === cycle.currentPhase) : null;
  const eyebrow = document.querySelector('[data-hero-eyebrow]');
  const month = phase ? labelOf(MONTHS, phase.month) : '';
  if (eyebrow && month) eyebrow.textContent = `Cycle ${cycle.cycle} · ${month}`;
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

function nowCard(cycle, phases) {
  const index = phases.findIndex((phase) => phase.id === cycle.currentPhase);
  const phase = phases[index];
  const days = clampDays(daysFromToday(cycle.nextDrop));
  const dates = phase ? [shortDate(phase.start), shortDate(phase.end)].filter(Boolean).join(' to ') : '';
  const drop = shortDate(cycle.nextDrop);
  return [
    el('span', { class: 'tag', text: 'Now' }),
    el('h3', { text: (phase && text(phase.label)) || text(cycle.title) || 'This cycle' }),
    el('p', { text: [labelOf(BLURB, cycle.currentPhase), dates ? `${dates}.` : ''].filter(Boolean).join(' ') }),
    phaseList(phases, index),
    el('p', { class: 'count' }, [
      el('span', { class: 'count__n', text: days === null ? DASH : String(days) }),
      el('span', { class: 'count__l', text: days === null ? 'Next MVP Drop date to be confirmed' : `days to the next MVP Drop${drop ? ` (${drop})` : ''}` }),
    ]),
  ];
}

function shortlistCard(cycle) {
  const items = buildCards(cycle.shortlist, (item, position) => el('li', { class: 'opt' }, [
    el('span', { text: text(item.title) || 'Untitled idea' }),
    el('span', { class: 'opt__label', text: `Idea ${String.fromCharCode(65 + position)}` }),
  ]), 3);
  const sample = items.some(([item]) => item.sample);
  const voting = cycle.currentPhase === 'vote';
  return [
    el('span', { class: 'tag tag--b', text: sample ? 'Shortlist (sample)' : 'Shortlist' }),
    el('h3', { text: voting ? 'Vote is open' : 'Vote opens soon' }),
    items.length
      ? el('ul', { class: 'opts' }, items.map(([, node]) => node))
      : el('p', { text: 'The shortlist appears here once the builders have narrowed the ideas.' }),
    el('div', { class: 'card__foot' }, el('a', { class: 'btn btn--ghost', href: 'vote.html', text: 'Go to the vote' })),
  ];
}

function fillCycle(cycle) {
  const now = slot('now');
  const shortlist = slot('shortlist');
  if (!cycle || !Array.isArray(cycle.phases)) {
    const message = 'Cycle details are not available right now. Check back soon.';
    now.replaceChildren(el('h3', { text: 'This cycle' }), el('p', { text: message }));
    shortlist.replaceChildren(el('h3', { text: 'Shortlist' }), el('p', { text: 'The shortlist is not available right now.' }));
    return;
  }
  now.replaceChildren(...nowCard(cycle, objects(cycle.phases)));
  shortlist.replaceChildren(...shortlistCard(cycle));
}

/** Runs one part of the page on its own, so a failure in it cannot stop the parts after it (it keeps its "Loading" text). */
const guard = (part) => attempt(part);

async function start() {
  const [cycle, stats, mvps, skills, builders, config] = await Promise.all(
    ['cycle', 'stats', 'mvps', 'skills', 'builders', 'config'].map(getData),
  );
  guard(() => fillEyebrow(cycle));
  guard(() => fillStats(stats, cycle));
  guard(() => fillCycle(cycle));
  guard(() => fillList(slot('mvps'), mvps, (mvp) => mvpCard(mvp), () => placeholderCard('MVPs are on the way', 'The first MVP lands at the end of the Build month. Until then, send in an idea.'), 3));
  guard(() => fillList(slot('skills'), skills, (skill) => skillCard(skill), () => placeholderCard('Skills are on the way', 'Practice skills will be listed here, each with a download and an example prompt.'), 3));
  guard(() => fillList(slot('builders'), builders, (builder) => builderCard(builder, config), () => placeholderCard('Builders', 'Builder details will appear here.'), 2));
}

start();
