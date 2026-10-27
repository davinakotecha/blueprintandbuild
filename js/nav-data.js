/*
 * nav-data.js (frontend-builder B). Where the pages are, in one place: the header nav, the footer links and the
 * list the search palette searches. Hrefs are relative with no leading slash. Page copy that is not navigation
 * lives in pages.json; the short descriptions here are search hints and labels only.
 */
export const NAV = [
  ['Home', 'index.html'],
  ['MVPs', 'catalog.html'],
  ['Skills', 'skills.html'],
  ['Vote', 'vote.html'],
  ['Thinkle', 'thinkle.html'],
  ['How it works', 'how-it-works.html'],
];

export const FOOTER_LINKS = [
  ['How it works', 'how-it-works.html'],
  ['Hall of fame', 'hall-of-fame.html'],
  ['Submit an idea', 'submit.html'],
];

/** `tags` are extra words people might type; they match after the title but before the description. */
export const PAGES = [
  { title: 'Home', href: 'index.html', description: 'This cycle, the latest MVPs and skills, and the builders.', tags: ['start', 'cycle', 'countdown', 'asset based consulting', 'knowledge share'] },
  { title: 'Submit an idea', href: 'submit.html', description: 'The one-page brief builder: your idea, the problem, a ten-minute demo and the data. Ideas are always open.', tags: ['form', 'suggest', 'propose', 'idea', 'brief', 'backlog'] },
  { title: 'MVPs', href: 'catalog.html', description: 'The catalog of reusable assets the practice has built, with live demos and filters.', tags: ['catalog', 'tools', 'filter', 'download', 'demo', 'asset based consulting'] },
  { title: 'Skills', href: 'skills.html', description: 'Knowledge Share: Claude skills from the practice, each with a download and an example prompt.', tags: ['claude', 'download', 'prompt', 'knowledge share'] },
  { title: 'How to install a skill', href: 'skills.html#install', description: 'Steps for the Claude app and Claude Code, including Copy for Claude Code.', tags: ['install', 'setup', 'claude code', 'upload'] },
  { title: 'Vote', href: 'vote.html', description: 'The shortlist for this cycle, the 10-day vote and how voting works in Slack.', tags: ['shortlist', 'slack', 'ballot', 'countdown'] },
  { title: 'IBM Thinkle', href: 'thinkle.html', description: 'Knowledge Share: a daily word game on the language of AI, consulting and IBM.', tags: ['wordle', 'game', 'daily', 'puzzle', 'words', 'knowledge share'] },
  { title: 'How it works', href: 'how-it-works.html', description: 'The two-month cycle, the ground rules and the FAQ.', tags: ['cycle', 'rules', 'faq', 'steps', 'process', 'asset based consulting'] },
  { title: 'Hall of fame', href: 'hall-of-fame.html', description: 'Winning ideas, the Box library, and the builders with their contact details.', tags: ['winners', 'credit', 'builders', 'idea owners', 'box', 'knowledge share', 'contact'] },
];
