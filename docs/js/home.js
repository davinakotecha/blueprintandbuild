/*
 * home.js (frontend-builder). Fills the Home page from site/data/*.json through content.js: the hero eyebrow,
 * the stats strip, the "This cycle" cards and the three card lists. Every list degrades to a short placeholder
 * card when its JSON is missing. Days to the next drop are worked out here, in the browser, from cycle.nextDrop.
 * DOM is built with createElement and textContent only.
 */
import { getData } from './content.js';
import { el } from './dom.js';
import { mvpCard, skillCard, builderCard, placeholderCard } from './home-cards.js';

const DASH = '—';
const MONTHS = { blueprint: 'Month 1: Blueprint', build: 'Month 2: Build' };
const BLURB = {
  ideas: 'Ideas are open. Send yours in before the window closes.',
  triage: 'The builders are narrowing the ideas to a shortlist.',
  vote: 'The shortlist is set. Vote in Slack.',
  scope: 'The winning idea is being scoped with the person who sent it.',
  build: 'The MVP is being built, then played back to the practice.',
};

function localDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** Whole days from today to an ISO date (0 once it has passed), or null if there is no date. */
export function daysUntil(iso) {
  const date = localDate(iso);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((date - today) / 86400000));
}

const short = (iso) => {
  const date = localDate(iso);
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date) : '';
};

const slot = (name) => document.querySelector(`[data-slot="${name}"]`);

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
  setStat('daysToDrop', cycle ? daysUntil(cycle.nextDrop) : null);
}

function fillEyebrow(cycle) {
  const phase = cycle && Array.isArray(cycle.phases) ? cycle.phases.find((item) => item.id === cycle.currentPhase) : null;
  const eyebrow = document.querySelector('[data-hero-eyebrow]');
  if (eyebrow && phase && MONTHS[phase.month]) eyebrow.textContent = `Cycle ${cycle.cycle} · ${MONTHS[phase.month]}`;
}

/** "16 Nov to 27 Nov", one date if start and end are the same day, or '' if either date is missing or invalid. */
function dateRange(startIso, endIso) {
  const start = localDate(startIso);
  const end = localDate(endIso);
  if (!start || !end) return '';
  return start.getTime() === end.getTime() ? short(startIso) : `${short(startIso)} to ${short(endIso)}`;
}

function phaseList(cycle, currentIndex) {
  return el('ol', { class: 'phases', 'aria-label': 'Phases of this cycle' }, cycle.phases.map((phase, index) => {
    const here = index === currentIndex;
    const dates = dateRange(phase.start, phase.end);
    return el('li', {
      class: here ? 'is-on' : index < currentIndex ? 'is-done' : '',
      'aria-current': here ? 'step' : null,
    }, [
      phase.label,
      here ? el('span', { class: 'sr-only', text: ' (now)' }) : null,
      dates ? ' ' : null,
      dates ? el('span', { class: 'phase__dates', text: dates }) : null,
    ]);
  }));
}

function nowCard(cycle) {
  const index = cycle.phases.findIndex((phase) => phase.id === cycle.currentPhase);
  const phase = cycle.phases[index];
  const days = daysUntil(cycle.nextDrop);
  const dates = phase ? [short(phase.start), short(phase.end)].filter(Boolean).join(' to ') : '';
  const drop = short(cycle.nextDrop);
  return [
    el('span', { class: 'tag', text: 'Now' }),
    el('h3', { text: phase ? phase.label : cycle.title }),
    el('p', { text: [BLURB[cycle.currentPhase], dates ? `${dates}.` : ''].filter(Boolean).join(' ') }),
    phaseList(cycle, index),
    el('p', { class: 'count' }, [
      el('span', { class: 'count__n', text: days === null ? DASH : String(days) }),
      el('span', { class: 'count__l', text: days === null ? 'Next MVP drop date to be confirmed' : `days to the next MVP drop${drop ? ` (${drop})` : ''}` }),
    ]),
  ];
}

function shortlistCard(cycle) {
  const list = cycle.shortlist || [];
  const sample = list.some((item) => item.sample);
  const voting = cycle.currentPhase === 'vote';
  return [
    el('span', { class: 'tag tag--b', text: sample ? 'Shortlist (sample)' : 'Shortlist' }),
    el('h3', { text: voting ? 'Vote is open' : 'Vote opens soon' }),
    list.length
      ? el('ul', { class: 'opts' }, list.slice(0, 3).map((item, index) => el('li', { class: 'opt' }, [
        el('span', { text: item.title }),
        el('span', { class: 'opt__label', text: `Idea ${String.fromCharCode(65 + index)}` }),
      ])))
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
  now.replaceChildren(...nowCard(cycle));
  shortlist.replaceChildren(...shortlistCard(cycle));
}

function fillCards(name, items, build, empty) {
  const host = slot(name);
  if (!host) return;
  const list = Array.isArray(items) ? items.slice(0, name === 'builders' ? 2 : 3) : [];
  if (!list.length) {
    host.dataset.count = '1';
    host.replaceChildren(placeholderCard(empty[0], empty[1]));
    return;
  }
  host.dataset.count = String(list.length);
  host.replaceChildren(...list.map(build));
}

async function start() {
  const [cycle, stats, mvps, skills, builders, config] = await Promise.all(
    ['cycle', 'stats', 'mvps', 'skills', 'builders', 'config'].map(getData),
  );
  fillEyebrow(cycle);
  fillStats(stats, cycle);
  fillCycle(cycle);
  fillCards('mvps', mvps, mvpCard, ['MVPs are on the way', 'The first MVP lands at the end of the Build month. Until then, send in an idea.']);
  fillCards('skills', skills, skillCard, ['Skills are on the way', 'Practice skills will be listed here, each with a download and an example prompt.']);
  fillCards('builders', builders, (builder) => builderCard(builder, config), ['Builders', 'Builder details will appear here.']);
}

start();
