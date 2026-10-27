/*
 * hall.js (frontend-builder). Fills the Hall of fame from mvps.json, builders.json, cycles.json and config.json
 * only (no data file of its own). Winners are the live MVPs, newest cycle first, each with its cycle, the idea
 * owner's credit, the builders and a link to the catalog card. With no winner yet it says so and when the first
 * cycle's MVP Drop is (from the calendar). The Knowledge Share card links to the practice's Box folder
 * (config.links.box) and shows "link coming soon" until that address is set. DOM is built with el() and textContent
 * only, and one malformed entry is skipped instead of blanking the page.
 */
import { getData } from './content.js';
import { el, slot, text, list } from './dom.js';
import { builderCard, placeholderCard, cardLink, actionLabel, webUrl, externalLink } from './home-cards.js';
import { shortDate } from './dates.js';
import { fillList } from './lists.js';
import { locate, todayIso } from './cycles.js';

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
      el('li', {}, el('span', { class: 'tag', text: Number.isFinite(mvp.cycle) && mvp.cycle > 0 ? `Cycle ${mvp.cycle}` : 'Launch set' })),
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

/** "The first cycle's MVP Drop is on 26 Feb." (or nothing if there is no calendar). */
function nextDropLine(cycles) {
  const here = locate(cycles, todayIso());
  return here.dropCycle ? `The next MVP Drop is on ${shortDate(here.dropCycle.drop)}.` : '';
}

function note(title, message) {
  return el('article', { class: 'card surface hall-note' }, [el('h3', { text: title }), el('p', { text: message })]);
}

function fillWinners(mvps, cycles) {
  const host = slot('winners');
  const noteHost = slot('note');
  if (!host) return;
  if (!Array.isArray(mvps)) {
    fillList(host, [], null, () => placeholderCard('Winners', 'The winners could not be loaded right now. Check back soon.'));
    return;
  }
  const winners = winnersOf(mvps);
  if (noteHost && !winners.length) {
    noteHost.replaceChildren(note('No winner yet', `${nextDropLine(cycles)} Until then, the best thing you can do is send in an idea.`.trim()));
  }
  fillList(host, winners, winnerCard, null);
  if (host.dataset.count) host.dataset.count = String(Math.min(Number(host.dataset.count), 3));
}

/** The Knowledge Share library: a Box folder where every MVP and its documents are kept. A placeholder until the address is set. */
function fillLibrary(config) {
  const host = slot('library');
  if (!host) return;
  const href = webUrl(config && config.links && config.links.box);
  host.replaceChildren(el('article', { class: 'card surface hall-library' }, [
    el('span', { class: 'tag tag--b', text: 'Knowledge Share' }),
    el('h3', { text: 'The MVP library on Box' }),
    el('p', { text: 'Every MVP and its documents are stored in one shared Box folder, so the practice can reuse them on engagements. This is where the Asset Based Consulting library lives.' }),
    el('div', { class: 'card__foot' }, href
      ? externalLink(href, 'Open the Box folder', 'btn', 'Open the Box folder')
      : el('span', { class: 'btn-note', text: 'Box link coming soon' })),
  ]));
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
  const [mvps, builders, cycles, config] = await Promise.all(['mvps', 'builders', 'cycles', 'config'].map(getData));
  fillWinners(mvps, cycles);
  fillLibrary(config);
  fillBuilders(builders, config);
}

start();
