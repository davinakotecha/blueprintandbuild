/*
 * ideas.js. The one function the idea form calls.
 *
 * Go-live behaviour: nothing is sent anywhere and nothing is stored. The form is the one-page MVP brief: it validates the
 * brief, builds a neatly formatted message in the same shape as the idea-to-brief skill and copies it to the clipboard;
 * the person pastes it in the Slack channel themselves. If the clipboard is blocked the message is returned too, so the
 * page can show it for copying by hand.
 *
 *   submitIdea({ idea, problem, does, demo, data, outOfScope, effort, name }) -> Promise<{ ok, copied, message?, errors? }>
 *
 * `does` is a list of up to three short bullets (the form passes an array; a string with one bullet per line also works).
 * `data` is one of DATA_CHOICES. It always resolves and never throws. If a real Slack post is added later, only this
 * function changes.
 */
import { copyText } from '../clipboard.js';

export const LIMITS = { idea: 140, problem: 600, does: 120, demo: 500, outOfScope: 300, effort: 300, name: 60 };
export const MAX_BULLETS = 3;

/** The data question. Anything that needs client data does not pass the practice's data check, so it is refused here. */
export const DATA_CHOICES = {
  internal: 'Internal data only',
  public: 'Public data only',
  synthetic: 'Synthetic (made-up) data only',
};

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const bulletsOf = (value) => (Array.isArray(value) ? value : clean(value).split(/\r?\n/)).map(clean).filter(Boolean);

function validate(v) {
  const errors = {};
  const need = (field, message, limit, label) => {
    if (!v[field]) errors[field] = message;
    else if (v[field].length > limit) errors[field] = `Keep ${label} to ${limit} characters or fewer. It is ${v[field].length} now.`;
  };
  need('idea', 'Enter your idea in one line.', LIMITS.idea, 'your idea');
  need('problem', 'Tell us what problem it solves and who has it.', LIMITS.problem, 'the problem');
  if (!v.does.length) errors.does = 'Add at least one thing the MVP does.';
  else if (v.does.length > MAX_BULLETS) errors.does = `Keep it to ${MAX_BULLETS} bullets at most.`;
  else if (v.does.some((line) => line.length > LIMITS.does)) errors.does = `Keep each bullet to ${LIMITS.does} characters or fewer.`;
  need('demo', 'Describe what the audience sees in a ten-minute demo.', LIMITS.demo, 'the demo');
  if (!Object.hasOwn(DATA_CHOICES, v.data)) errors.data = v.data === 'client'
    ? 'Ideas that need client data do not pass the data check. Describe a version that works on internal, public or synthetic data.'
    : 'Choose the data the MVP would use.';
  if (v.outOfScope.length > LIMITS.outOfScope) errors.outOfScope = `Keep this to ${LIMITS.outOfScope} characters or fewer. It is ${v.outOfScope.length} now.`;
  if (v.effort.length > LIMITS.effort) errors.effort = `Keep this to ${LIMITS.effort} characters or fewer. It is ${v.effort.length} now.`;
  if (v.name.length > LIMITS.name) errors.name = `Keep your name to ${LIMITS.name} characters or fewer. It is ${v.name.length} now.`;
  return errors;
}

/** The text that gets pasted into Slack. Plain text with Slack's *bold*, in the order of the one-page brief. */
export function formatMessage({ idea, problem, does, demo, data, outOfScope, effort, name }) {
  return [
    '*New idea for Blueprint & Build*',
    `*Idea in one line:* ${idea}`,
    `*Problem and who has it:* ${problem}`,
    '*What the MVP does:*',
    ...bulletsOf(does).slice(0, MAX_BULLETS).map((line) => `• ${line}`),
    `*Ten-minute demo:* ${demo}`,
    `*Data:* ${Object.hasOwn(DATA_CHOICES, data) ? DATA_CHOICES[data] : data}`,
    `*Out of scope for now:* ${outOfScope || 'Not stated'}`,
    `*Rough effort (two people, about six days?):* ${effort || 'Not stated'}`,
    `*Submitted by:* ${name || 'Anonymous'}`,
  ].join('\n');
}

export async function submitIdea(input) {
  const source = input && typeof input === 'object' ? input : {};
  const values = {
    idea: clean(source.idea),
    problem: clean(source.problem),
    does: bulletsOf(source.does),
    demo: clean(source.demo),
    data: clean(source.data),
    outOfScope: clean(source.outOfScope),
    effort: clean(source.effort),
    name: clean(source.name),
  };
  const errors = validate(values);
  if (Object.keys(errors).length) return { ok: false, copied: false, errors };
  const message = formatMessage(values);
  let copied = false;
  try {
    copied = await copyText(message);
  } catch {
    copied = false;
  }
  return { ok: true, copied, message };
}
