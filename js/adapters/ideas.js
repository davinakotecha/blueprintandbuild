/*
 * ideas.js. The one function the idea form calls.
 *
 * Go-live behaviour: nothing is sent anywhere and nothing is stored. The form validates the idea, builds a neatly
 * formatted message and copies it to the clipboard; the person pastes it in the Slack channel themselves. If the
 * clipboard is blocked the message is returned too, so the page can show it for copying by hand.
 *
 *   submitIdea({ idea, problem, name }) -> Promise<{ ok, copied, message?, errors? }>
 *
 * It always resolves and never throws. If a real Slack post is added later, only this function changes.
 */
import { copyText } from '../clipboard.js';

export const LIMITS = { idea: 140, problem: 600, name: 60 };

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function validate({ idea, problem, name }) {
  const errors = {};
  if (!idea) errors.idea = 'Enter your idea in one line.';
  else if (idea.length > LIMITS.idea) errors.idea = `Keep your idea to ${LIMITS.idea} characters or fewer. It is ${idea.length} now.`;
  if (!problem) errors.problem = 'Tell us what problem it solves and who it is for.';
  else if (problem.length > LIMITS.problem) errors.problem = `Keep the problem to ${LIMITS.problem} characters or fewer. It is ${problem.length} now.`;
  if (name.length > LIMITS.name) errors.name = `Keep your name to ${LIMITS.name} characters or fewer. It is ${name.length} now.`;
  return errors;
}

/** The text that gets pasted into Slack. Plain text with Slack's *bold*, so it reads well without any formatting. */
export function formatMessage({ idea, problem, name }) {
  return [
    '*New idea for Blueprint & Build*',
    `*Idea:* ${idea}`,
    `*Problem and who it is for:* ${problem}`,
    `*Submitted by:* ${name || 'Anonymous'}`,
  ].join('\n');
}

export async function submitIdea(input) {
  const source = input && typeof input === 'object' ? input : {};
  const values = { idea: clean(source.idea), problem: clean(source.problem), name: clean(source.name) };
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
