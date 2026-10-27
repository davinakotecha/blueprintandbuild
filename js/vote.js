/*
 * vote.js (frontend-builder A). The vote page: the shortlist for the cycle whose vote is next or running (cycle.json
 * `shortlists`, keyed by cycle number), a countdown worked out in the browser from the calendar (cycles.json) and
 * today's date, and a "Vote in the Slack channel" button that links to config.links.slackChannel (an https address) or,
 * if that is empty, to the Slack app link when the team and channel IDs are set. "How the vote works" comes from
 * pages.json (`vote.points`) and the whole block is hidden when there are none. The countdown is recomputed at most
 * once a minute and the text is only rewritten when it changes, so the live region speaks once a day at most.
 * DOM is built with createElement and textContent.
 */
import { getData } from './content.js';
import { el, slot, text, list, attempt } from './dom.js';
import { placeholderCard, webUrl, externalLink } from './home-cards.js';
import { channelHref } from './slack.js';
import { shortDate, daysFromToday, rangeText } from './dates.js';
import { fillList } from './lists.js';
import { voteWindow, todayIso } from './cycles.js';

const NOTE_NO_SLACK = 'You vote with a reaction in the Slack channel when the window opens. There is nothing to do until then.';
const MINUTE = 60 * 1000;

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** The countdown sentence for the vote phase, or '' when there is no usable vote phase. */
function countdownText({ phase, cycle, closed }) {
  if (!phase) return '';
  const untilStart = daysFromToday(phase.start);
  const untilEnd = daysFromToday(phase.end);
  if (untilStart === null || untilEnd === null) return '';
  const name = text(cycle.title);
  if (untilStart > 0) {
    const before = closed ? `${text(closed.title)} voting has closed. ` : '';
    return `${before}${name} voting opens in ${days(untilStart)} (${shortDate(phase.start)})`;
  }
  if (untilEnd >= 0) {
    const when = untilEnd === 0 ? 'today' : `in ${days(untilEnd)}`;
    return `${name} voting closes ${when} (${shortDate(phase.end)})`;
  }
  return `${name} voting has closed`;
}

function ideaCard(idea, index, link) {
  const title = text(idea.title) || 'Untitled idea';
  return el('article', { class: 'card surface idea' }, [
    el('ul', { class: 'tag-list', 'aria-label': 'Labels' }, [
      el('li', {}, el('span', { class: 'tag tag--b', text: `Idea ${String.fromCharCode(65 + index)}` })),
    ]),
    el('h3', { text: title }),
    el('p', { text: text(idea.pitch) }),
    link ? el('div', { class: 'card__foot' }, link(title)) : null,
  ]);
}

/** The "Vote in Slack" control for one card: an https link to the channel (new tab), else the Slack app link, else nothing. */
function voteLink(config) {
  const web = webUrl(config && config.links && config.links.slackChannel);
  if (web) return (title) => externalLink(web, 'Vote in Slack', 'btn', `Vote in Slack for ${title}`);
  const app = attempt(() => channelHref(config));
  if (app) return (title) => el('a', { class: 'btn', href: app }, ['Vote in Slack', el('span', { class: 'sr-only', text: ` for ${title}` })]);
  return null;
}

function showShortlist(cycle, windowInfo, link) {
  const target = windowInfo && windowInfo.cycle;
  const items = target && cycle && cycle.shortlists ? cycle.shortlists[String(target.cycle)] : null;
  const opens = windowInfo ? shortDate(windowInfo.phase.start) : '';
  fillList(
    slot('shortlist'),
    items,
    (idea, index) => ideaCard(idea, index, link),
    () => placeholderCard(
      'The shortlist is not set yet',
      `Ideas are always open. Before each vote the builders pick the top three from the backlog${opens ? `; the next vote opens on ${opens}` : ''}. Send an idea in and it is in the running.`,
    ),
  );
}

function showCountdown(windowInfo) {
  const target = document.querySelector('[data-countdown]');
  const dates = document.querySelector('[data-vote-dates]');
  if (!windowInfo || !windowInfo.phase) {
    target.textContent = '';
    target.hidden = true;
    return;
  }
  const range = rangeText(windowInfo.phase.start, windowInfo.phase.end);
  if (dates && range) dates.textContent = range;
  const update = () => {
    const next = countdownText(windowInfo);
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

/** The channel link under "How the vote works", so people can find where the vote happens. */
function showChannel(config) {
  const host = document.querySelector('[data-channel]');
  if (!host) return;
  const web = webUrl(config && config.links && config.links.slackChannel);
  const name = config && config.slack && typeof config.slack.channelName === 'string' ? config.slack.channelName.trim() : '';
  const label = name ? `#${name}` : 'the Slack channel';
  host.replaceChildren(...(web
    ? ['Voting happens in ', externalLink(web, label, 'text-link', `Open ${label} in Slack`), '. Open it to cast your vote.']
    : [`Voting happens in ${label} on Slack.`]));
}

async function start() {
  const [cycle, cycles, config, pages] = await Promise.all([getData('cycle'), getData('cycles'), getData('config'), getData('pages')]);
  const windowInfo = voteWindow(cycles, todayIso());
  const link = voteLink(config);
  const note = document.querySelector('[data-slack-note]');
  if (note) {
    note.textContent = NOTE_NO_SLACK;
    note.hidden = Boolean(link);
  }
  showPoints(pages);
  showChannel(config);
  showShortlist(cycle, windowInfo, link);
  showCountdown(windowInfo);
}

start();
