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
  ['How it works', 'how-it-works.html'],
];

export const FOOTER_LINKS = [
  ['How it works', 'how-it-works.html'],
  ['Hall of fame', 'hall-of-fame.html'],
  ['Submit an idea', 'submit.html'],
];

/** `tags` are extra words people might type; they match after the title but before the description. */
export const PAGES = [
  { title: 'Home', href: 'index.html', description: 'This cycle, the latest MVPs and skills, and the builders.', tags: ['start', 'cycle', 'countdown'] },
  { title: 'Submit an idea', href: 'submit.html', description: 'Three short fields: your idea, the problem and who it is for, and your name.', tags: ['form', 'suggest', 'propose', 'idea'] },
  { title: 'MVPs', href: 'catalog.html', description: 'The catalog of everything the practice has built, with filters.', tags: ['catalog', 'tools', 'filter', 'download'] },
  { title: 'Skills', href: 'skills.html', description: 'Claude skills from the practice, each with a download and an example prompt.', tags: ['claude', 'download', 'prompt'] },
  { title: 'How to install a skill', href: 'skills.html#install', description: 'Steps for the Claude app, Claude Code and team plans.', tags: ['install', 'setup', 'claude code', 'upload'] },
  { title: 'Vote', href: 'vote.html', description: 'The shortlist for this cycle and how voting works in Slack.', tags: ['shortlist', 'slack', 'ballot', 'countdown'] },
  { title: 'How it works', href: 'how-it-works.html', description: 'The two-month cycle, the ground rules and the FAQ.', tags: ['cycle', 'rules', 'faq', 'steps', 'process'] },
  { title: 'Hall of fame', href: 'hall-of-fame.html', description: 'Winning ideas, the people who sent them in, and the builders.', tags: ['winners', 'credit', 'builders', 'idea owners'] },
];
