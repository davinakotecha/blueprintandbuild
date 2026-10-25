/*
 * hall.js (frontend-builder). Fills the Hall of fame from mvps.json, builders.json, cycle.json and config.json
 * only (no data file of its own). Winners are the live MVPs, newest cycle first, each with its cycle, the idea
 * owner's credit, the builders and a link to the catalog card. With no winner yet it says so and when the first
 * one is announced (cycle.nextDrop). Sample entries are marked. DOM is built with el() and textContent only, and
 * one malformed entry is skipped instead of blanking the page.
 */
import { getData } from './content.js';
import { el, slot, text, list } from './dom.js';
import { builderCard, placeholderCard, cardLink, actionLabel } from './home-cards.js';
import { shortDate } from './dates.js';
import { fillList } from './lists.js';

/** Live MVPs, newest cycle first (an MVP with no cycle goes last), then by id, newest first. */
function winnersOf(mvps) {
  const rank = (mvp) => (Number.isFinite(mvp.cycle) ? mvp.cycle : -1);
  return (Array.isArray(mvps) ? mvps : [])
    .filter((mvp) => mvp && mvp.status === 'live' && text(mvp.id) && text(mvp.title))
    .sort((a, b) => rank(b) - rank(a) || String(b.id).localeCompare(String(a.id)));
}

function winnerCard(mvp) {
  const owner = text(mvp.ideaOwner);
  const builders = list(mvp.builders);
  return el('article', { class: 'card surface winner' }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Labels' }, [
      el('li', {}, el('span', { class: 'tag', text: Number.isFinite(mvp.cycle) ? `Cycle ${mvp.cycle}` : 'Winner' })),
      mvp.sample ? el('li', {}, el('span', { class: 'tag', text: 'Sample' })) : null,
    ]),
    el('h3', { text: text(mvp.title) }),
    (owner || builders.length) ? el('dl', { class: 'credit' }, [
      owner ? el('div', {}, [el('dt', { text: 'Idea by' }), el('dd', { text: owner })]) : null,
      builders.length ? el('div', {}, [el('dt', { text: 'Built by' }), el('dd', { text: builders.join(', ') })]) : null,
    ]) : null,
    el('div', { class: 'card__foot' }, el('a', {
      class: 'btn btn--ghost',
      href: cardLink('catalog.html', mvp.id),
      text: 'See it in the catalog',
      'aria-label': actionLabel('See it in the catalog', text(mvp.title)),
    })),
  ]);
}

/** "The first winner is announced at MVP Drop #1 on 28 Jan." (or a shorter line if the cycle has no date yet). */
function firstWinnerLine(cycle) {
  const date = cycle ? shortDate(cycle.nextDrop) : '';
  const number = cycle && Number.isFinite(cycle.cycle) ? ` #${cycle.cycle}` : '';
  return `The first winner is announced at MVP Drop${number}${date ? ` on ${date}` : ''}.`;
}

function note(title, message) {
  return el('article', { class: 'card surface hall-note' }, [el('h3', { text: title }), el('p', { text: message })]);
}

function fillWinners(mvps, cycle) {
  const host = slot('winners');
  const noteHost = slot('note');
  if (!host) return;
  if (!Array.isArray(mvps)) {
    fillList(host, [], null, () => placeholderCard('Winners', 'The winners could not be loaded right now. Check back soon.'));
    return;
  }
  const winners = winnersOf(mvps);
  const real = winners.filter((mvp) => !mvp.sample);
  if (noteHost && !real.length) {
    noteHost.replaceChildren(note(
      winners.length ? 'No real winner yet' : 'No winner yet',
      `${firstWinnerLine(cycle)}${winners.length ? ' The entries below are samples that show how this page will look.' : ' Until then, the best thing you can do is send in an idea.'}`,
    ));
  }
  fillList(host, winners, winnerCard, null);
  if (host.dataset.count) host.dataset.count = String(Math.min(Number(host.dataset.count), 3));
}

function fillBuilders(builders, config) {
  fillList(
    slot('builders'),
    Array.isArray(builders) ? builders.filter((builder) => builder && text(builder.name)) : [],
    (builder) => builderCard(builder, config),
    () => placeholderCard('Builders', 'The builders will be introduced here.'),
  );
  const host = slot('builders');
  if (host && host.dataset.count) host.dataset.count = String(Math.min(Number(host.dataset.count), 3));
}

async function start() {
  const [mvps, builders, cycle, config] = await Promise.all(['mvps', 'builders', 'cycle', 'config'].map(getData));
  fillWinners(mvps, cycle);
  fillBuilders(builders, config);
}

start();
