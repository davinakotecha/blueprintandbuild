/*
 * dates.js. The one place that reads ISO dates (YYYY-MM-DD) from the data files. Home, the vote page and the hall of
 * fame each had their own copy. Dates are local dates (no time zone), and "today" is local midnight, so a countdown
 * changes at midnight where the visitor is. Anything that is not a real calendar date gives null (or '' as text).
 */
const DAY = 86400000;
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** A Date at local midnight for an ISO date, or null if it is not a real date (2026-02-31 is null, not 3 March). */
export function parseDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === 'string' ? iso : '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** "30 Nov", or '' if the date is invalid. */
export function shortDate(iso) {
  const date = parseDate(iso);
  return date ? SHORT.format(date) : '';
}

/** Whole days from today to the date: positive before it, 0 on the day, negative after it, null if invalid. */
export function daysFromToday(iso) {
  const date = parseDate(iso);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date - today) / DAY);
}

/** Keeps a count of days at 0 or more once a date has passed; null stays null. */
export const clampDays = (days) => (days === null ? null : Math.max(0, days));

/** "16 Nov to 27 Nov", one date if both are the same day, or '' if either date is invalid. */
export function rangeText(startIso, endIso) {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start || !end) return '';
  return start.getTime() === end.getTime() ? SHORT.format(start) : `${SHORT.format(start)} to ${SHORT.format(end)}`;
}
