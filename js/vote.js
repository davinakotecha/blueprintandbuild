/*
 * vote.js (frontend-builder A). The vote page: the shortlist from cycle.json as cards, a countdown worked out in
 * the browser from the `vote` phase in cycle.phases, and a "Vote in Slack" button that exists only when
 * config.features.slackLinks is true and the Slack team and channel IDs are set. Otherwise a note says voting
 * happens in Slack when it opens. "How the vote works" comes from pages.json (`vote.points`) and the whole block is
 * hidden when there are none. The countdown is recomputed at most once a minute and the text is only rewritten
 * when it changes, so the live region speaks once a day at most. DOM is built with createElement and textContent.
 */
import { getData } from './content.js';
import { el, slot, text, list, attempt } from './dom.js';
import { placeholderCard } from './home-cards.js';
import { channelHref } from './slack.js';
import { shortDate, daysFromToday, rangeText } from './dates.js';
import { fillList, hasSample, revealSampleNote } from './lists.js';

const NOTE_NO_SLACK = 'You vote with a reaction in the Slack channel when the window opens. There is nothing to do until then.';
const MINUTE = 60 * 1000;

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** The countdown sentence for the vote phase, or '' when the cycle has no usable vote phase. */
function countdownText(phase) {
  if (!phase) return '';
  const untilStart = daysFromToday(phase.start);
  const untilEnd = daysFromToday(phase.end);
  if (untilStart === null || untilEnd === null) return '';
  if (untilStart > 0) return `Voting opens in ${days(untilStart)} (${shortDate(phase.start)})`;
  if (untilEnd >= 0) {
    const when = untilEnd === 0 ? 'today' : `in ${days(untilEnd)}`;
    return `Voting closes ${when} (${shortDate(phase.end)})`;
  }
  return 'Voting has closed';
}

function ideaCard(idea, index, href) {
  const title = text(idea.title) || 'Untitled idea';
  return el('article', { class: 'card surface idea' }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Labels' }, [
      el('li', {}, el('span', { class: 'tag tag--b', text: `Idea ${String.fromCharCode(65 + index)}` })),
      idea.sample ? el('li', {}, el('span', { class: 'tag', text: 'Sample' })) : null,
    ]),
    el('h3', { text: title }),
    el('p', { text: text(idea.pitch) }),
    href ? el('div', { class: 'card__foot' }, el('a', { class: 'btn', href }, [
      'Vote in Slack', el('span', { class: 'sr-only', text: ` for ${title}` }),
    ])) : null,
  ]);
}

function showShortlist(cycle, href) {
  const shown = fillList(
    slot('shortlist'),
    cycle ? cycle.shortlist : null,
    (idea, index) => ideaCard(idea, index, href),
    () => placeholderCard('The shortlist is not set yet', 'It appears here once the builders have narrowed the ideas to three.'),
  );
  revealSampleNote('shortlist', hasSample(shown));
}

function showCountdown(cycle) {
  const phase = cycle && Array.isArray(cycle.phases) ? cycle.phases.find((item) => item && item.id === 'vote') : null;
  const target = document.querySelector('[data-countdown]');
  const dates = document.querySelector('[data-vote-dates]');
  if (!phase) {
    target.textContent = '';
    target.hidden = true;
    return;
  }
  const range = rangeText(phase.start, phase.end);
  if (dates && range) dates.textContent = range;
  const update = () => {
    const next = countdownText(phase);
    if (target.textContent !== next) target.textContent = next;
    target.hidden = !next;
  };
  update();
  window.setInterval(update, MINUTE);
}

/** "How the vote works": pages.json `vote.points`, or no block at all when there are none. */
function showPoints(pages) {
  const points = list(pages && pages.vote && pages.vote.points);
  const host = document.querySelector('[data-how]');
  const block = host ? host.closest('section') : null;
  if (!host || !block) return;
  host.replaceChildren(...points.map((line) => el('li', { text: line })));
  block.hidden = !points.length;
}

async function start() {
  const [cycle, config, pages] = await Promise.all([getData('cycle'), getData('config'), getData('pages')]);
  const href = attempt(() => channelHref(config));
  const note = document.querySelector('[data-slack-note]');
  if (note) {
    note.textContent = NOTE_NO_SLACK;
    note.hidden = Boolean(href);
  }
  showPoints(pages);
  showShortlist(cycle, href);
  showCountdown(cycle);
}

start();
