/*
 * submit.js (frontend-builder B). Wires the idea form: character counters, validation messages, the error
 * summary, the honeypot, the call to adapters/ideas.js and the success state. No network call is made here;
 * the adapter is the only thing that decides where an idea goes. DOM text is set with textContent only.
 */
import { el } from './dom.js';
import { getData } from './content.js';
import { LIMITS, submitIdea } from './adapters/ideas.js';
import { announce, copyText } from './clipboard.js';
import { openChannelHref } from './slack.js';
import { getTier } from './tier.js';

const FIELDS = ['idea', 'problem', 'name'];
const NEAR = 0.9;

const form = document.querySelector('[data-idea-form]');
const $ = (id) => document.getElementById(id);
const value = (field) => $(field).value.trim();

const state = { pending: false };

/* ------------------------------------------------------------------ counters
 * The visible number follows every keystroke (aria-hidden). The live region only speaks on blur and when the
 * field gets near or over its limit, so a screen reader is not read a number for every letter. */
const counter = (field) => document.querySelector(`[data-count="${field}"]`);

function level(field) {
  const length = $(field).value.length;
  if (length > LIMITS[field]) return 'over';
  return length >= LIMITS[field] * NEAR ? 'near' : 'ok';
}

function spoken(field) {
  const length = $(field).value.length;
  const left = LIMITS[field] - length;
  if (left < 0) return `${-left} characters over the limit of ${LIMITS[field]}.`;
  if (level(field) === 'near') return `${left} characters left.`;
  return `${length} of ${LIMITS[field]} characters.`;
}

function paint(field) {
  const box = counter(field);
  box.querySelector('[data-count-text]').textContent = `${$(field).value.length} / ${LIMITS[field]}`;
  const now = level(field);
  box.classList.toggle('is-near', now === 'near');
  box.classList.toggle('is-over', now === 'over');
  return now;
}

function speak(field) {
  counter(field).querySelector('[data-count-live]').textContent = spoken(field);
}

function wireCounter(field) {
  let last = paint(field);
  $(field).addEventListener('input', () => {
    const now = paint(field);
    if (now !== last && (now !== 'ok' || last === 'over')) speak(field);
    last = now;
    clearFixed(field);
  });
  $(field).addEventListener('blur', () => {
    // Leaving a field only speaks when there is something to say: near or over the limit. Otherwise stay silent
    // (and drop any older message that is no longer true), so tabbing through the form is not a stream of numbers.
    if (level(field) === 'ok') counter(field).querySelector('[data-count-live]').textContent = '';
    else speak(field);
  });
}

/* ------------------------------------------------------------------ errors */
const errorNode = (field) => $(`${field}-error`);

function showFieldError(field, message) {
  const node = errorNode(field);
  node.textContent = message;
  node.hidden = false;
  $(field).setAttribute('aria-invalid', 'true');
}

function clearFieldError(field) {
  const node = errorNode(field);
  node.textContent = '';
  node.hidden = true;
  $(field).removeAttribute('aria-invalid');
}

/** After a failed submit, an error goes away as soon as the field is fixed (the adapter checks again on send). */
function clearFixed(field) {
  if ($(field).getAttribute('aria-invalid') !== 'true') return;
  const length = value(field).length;
  const required = field !== 'name';
  if (length <= LIMITS[field] && (length > 0 || !required)) {
    clearFieldError(field);
    refreshSummary();
  }
}

function refreshSummary() {
  const host = document.querySelector('[data-error-summary]');
  const remaining = FIELDS.filter((field) => $(field).getAttribute('aria-invalid') === 'true');
  if (!remaining.length) host.replaceChildren();
  else host.querySelectorAll('li').forEach((item) => { item.hidden = !remaining.includes(item.dataset.field); });
}

function showSummary(errors) {
  const host = document.querySelector('[data-error-summary]');
  const items = FIELDS.filter((field) => errors[field]).map((field) => {
    // The message already names the field ("Enter your idea in one line."), so the link text is the message alone.
    const link = el('a', { href: `#${field}`, text: errors[field] });
    link.addEventListener('click', (event) => {
      event.preventDefault();
      $(field).focus();
    });
    return el('li', { 'data-field': field }, link);
  });
  const summary = el('div', { class: 'error-summary', tabindex: '-1', role: 'group', 'aria-labelledby': 'error-summary-title' }, [
    el('h3', { id: 'error-summary-title', text: items.length === 1 ? 'There is 1 problem to fix' : `There are ${items.length} problems to fix` }),
    el('ul', {}, items),
  ]);
  host.replaceChildren(summary);
  summary.focus();
}

function showErrors(errors) {
  FIELDS.forEach((field) => (errors[field] ? showFieldError(field, errors[field]) : clearFieldError(field)));
  showSummary(errors);
}

/* ------------------------------------------------------------------ success */
let confettiTimer = 0;

/** Clears the confetti when its animation ends. The first piece is shown in every tier that shows any (the last is
 * display:none in lite, so it never fires animationend); a timer covers a browser that skips the event. */
function celebrate() {
  const host = document.querySelector('[data-celebrate]');
  window.clearTimeout(confettiTimer);
  host.replaceChildren();
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || getTier() === 'static') return;
  host.append(...Array.from({ length: 12 }, (_, at) => el('i', { style: `--i: ${at}` })));
  const clear = () => { window.clearTimeout(confettiTimer); host.replaceChildren(); };
  host.firstElementChild.addEventListener('animationend', clear, { once: true });
  confettiTimer = window.setTimeout(clear, 1500);
}

/**
 * The form sends nothing. The success state says what really happened: the message was copied (or, if the browser
 * blocked that, it is shown for copying by hand) and the person pastes it in the Slack channel.
 */
function showSuccess(name, result) {
  const title = document.querySelector('[data-success-title]');
  const copied = Boolean(result && result.copied);
  const thanks = name ? `Thanks, ${name}. ` : 'Thanks. ';
  title.textContent = copied ? `${thanks}Copied.` : `${thanks}One more step.`;
  const next = document.querySelector('[data-success-next]');
  next.hidden = !copied;
  const manual = document.querySelector('[data-manual]');
  manual.hidden = copied;
  const area = document.querySelector('[data-message]');
  area.value = result && result.message ? result.message : '';
  lastMessage = area.value;
  form.hidden = true;
  document.querySelector('[data-form-title]').hidden = true;
  document.querySelector('[data-success]').hidden = false;
  if (copied) {
    celebrate();
    announce('Copied. Paste it in the Slack channel.');
  }
  title.focus();
}

/* ------------------------------------------------------------------ slack channel name and Open Slack */
let lastMessage = '';
let config = null;

/** The channel's name (and an "Open Slack" button) come from config.json. The button needs team and channel IDs. */
function applyConfig() {
  const name = config && config.slack && typeof config.slack.channelName === 'string' ? config.slack.channelName.trim() : '';
  const label = name ? `#${name}` : 'the Slack channel';
  document.querySelector('[data-channel-name]').textContent = label;
  const open = document.querySelector('[data-open-slack]');
  const href = openChannelHref(config);
  open.hidden = !href;
  if (href) open.setAttribute('href', href);
}

async function copyAgain() {
  const ok = await copyText(lastMessage);
  announce(ok ? 'Copied again.' : 'Could not copy. Select the message and copy it by hand.');
}

function again() {
  form.reset();
  FIELDS.forEach((field) => { clearFieldError(field); paint(field); counter(field).querySelector('[data-count-live]').textContent = ''; });
  document.querySelector('[data-error-summary]').replaceChildren();
  document.querySelector('[data-success]').hidden = true;
  window.clearTimeout(confettiTimer);
  document.querySelector('[data-celebrate]').replaceChildren();
  document.querySelector('[data-form-title]').hidden = false;
  form.hidden = false;
  $('idea').focus();
}

/* ------------------------------------------------------------------ submit */
async function onSubmit(event) {
  event.preventDefault();
  if (state.pending) return;
  const button = document.querySelector('[data-submit]');
  state.pending = true;
  button.disabled = true;
  button.textContent = 'Copying…';
  try {
    if ($('homepage').value) {
      // A person never sees this field. Look like a success, copy nothing.
      showSuccess('', { copied: true, message: '' });
      return;
    }
    const result = await submitIdea({ idea: value('idea'), problem: value('problem'), name: value('name') });
    if (result && result.ok) showSuccess(value('name'), result);
    else showErrors((result && result.errors) || { idea: 'Something went wrong. Please try again.' });
  } catch {
    showErrors({ idea: 'Something went wrong. Please try again.' });
  } finally {
    state.pending = false;
    button.disabled = false;
    button.textContent = 'Copy my idea for Slack';
  }
}

/* ------------------------------------------------------------------ "what happens next" (copy from pages.json) */
async function fillNext() {
  const pages = await getData('pages');
  const steps = pages && pages.howItWorks && Array.isArray(pages.howItWorks.steps) ? pages.howItWorks.steps : [];
  const next = steps.filter((step) => step && step.id !== 'ideas' && step.title && step.summary).slice(0, 3);
  if (!next.length) return;
  document.querySelector('[data-next-list]').replaceChildren(
    ...next.map((step) => el('li', {}, [el('strong', { text: step.title }), el('span', { text: step.summary })])),
  );
  document.querySelector('[data-next]').hidden = false;
}

function start() {
  if (!form) return;
  FIELDS.forEach(wireCounter);
  form.addEventListener('submit', onSubmit);
  document.querySelector('[data-again]').addEventListener('click', again);
  document.querySelector('[data-copy-again]').addEventListener('click', copyAgain);
  fillNext();
  getData('config').then((data) => { config = data; applyConfig(); });
}

start();
