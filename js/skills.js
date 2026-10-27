/*
 * skills.js (frontend-builder A). The Claude skills page: the "How to install" disclosure (steps from
 * pages.json "install", or a short hint built from the first skill when that file is missing) and the skill cards
 * from skills.json. The disclosure is a button with aria-expanded and aria-controls inside the section heading.
 * It is closed unless the URL hash is #install; it also opens when the hash changes to #install later and when an
 * in-page link to #install is clicked. One malformed skill is skipped instead of blanking the page.
 */
import { getData } from './content.js';
import { el, slot, text, labelOf } from './dom.js';
import { copyButton } from './clipboard.js';
import {
  skillCard, placeholderCard, focusTarget, webUrl, externalLink, safeSkillName,
} from './home-cards.js';
import { fillList } from './lists.js';

const LINK_LABEL = { claudeSkillsHelp: 'Read the Claude Help Center guide' };

function stepItem(step, links) {
  const code = typeof step.code === 'string' ? step.code.replace(/\s+$/, '') : '';
  const linkKey = text(step.linkKey);
  const href = linkKey && links && Object.hasOwn(links, linkKey) ? webUrl(links[linkKey]) : '';
  return el('li', { class: 'install__step' }, [
    el('h3', { text: text(step.title) || 'Step' }),
    text(step.text) ? el('p', { text: text(step.text) }) : null,
    code ? el('pre', { class: 'install__code', tabindex: '0' }, el('code', { text: code })) : null,
    code || href ? el('div', { class: 'install__actions' }, [
      code ? copyButton({ label: 'Copy commands', text: code, message: 'Commands copied' }) : null,
      href ? externalLink(href, labelOf(LINK_LABEL, linkKey, 'Read more'), 'btn btn--ghost') : null,
    ]) : null,
  ]);
}

/** Shown when pages.json is missing or has no install section: the one Claude Code step, from a real skill name. */
function fallbackSteps(skills) {
  const first = Array.isArray(skills) ? skills.find((skill) => skill && safeSkillName(skill.name)) : null;
  const folder = first ? safeSkillName(first.name) : 'skill-folder';
  return {
    intro: 'Download a skill from its card, then copy it into your Claude skills folder.',
    steps: [{
      title: 'Claude Code',
      text: 'Unzip the skill and copy its folder into ~/.claude/skills/ to use it in every project, or into .claude/skills/ inside one repo.',
      code: `cp -r ${folder} ~/.claude/skills/`,
    }],
  };
}

function panelBody(install, links) {
  const steps = Array.isArray(install.steps) ? install.steps.filter((step) => step && typeof step === 'object') : [];
  return [
    text(install.intro) ? el('p', { class: 'install__intro', text: text(install.intro) }) : null,
    el('ol', { class: 'install__steps' }, steps.map((step) => stepItem(step, links))),
  ];
}

/** Turns the section heading into a disclosure button and puts the install steps in the panel. */
function buildInstall(section, install, links) {
  const heading = section.querySelector('h2');
  const host = section.querySelector('[data-slot="install"]');
  if (!heading || !host) return null;
  const label = heading.textContent;
  const button = el('button', {
    type: 'button', class: 'disclosure__btn', 'aria-expanded': 'false', 'aria-controls': 'install-panel',
  }, [el('span', { text: label }), el('span', { class: 'disclosure__icon', 'aria-hidden': 'true' })]);
  const panel = el('div', { class: 'disclosure__panel', id: 'install-panel', hidden: true }, panelBody(install, links));
  heading.replaceChildren(button);
  host.replaceChildren(panel);

  const set = (open) => {
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  button.addEventListener('click', () => set(panel.hidden));
  return { button, set, panel };
}

function wireInstall(disclosure) {
  // Closed by default; open only when the visitor arrived by a link to #install.
  disclosure.set(window.location.hash === '#install');
  window.addEventListener('hashchange', () => {
    if (window.location.hash !== '#install') return;
    disclosure.set(true);
    disclosure.button.scrollIntoView({ block: 'start' });
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href$="#install"]');
    if (link) disclosure.set(true);
  });
}

async function start() {
  const [skills, pages, config] = await Promise.all(['skills', 'pages', 'config'].map(getData));
  const section = document.getElementById('install');
  const install = pages && pages.install && Array.isArray(pages.install.steps) && pages.install.steps.length
    ? pages.install
    : fallbackSteps(skills);
  const disclosure = section ? buildInstall(section, install, config && config.links) : null;
  if (disclosure) wireInstall(disclosure);

  fillList(
    slot('skills'),
    skills,
    (skill) => skillCard(skill, { detail: true }),
    () => placeholderCard('Skills are on the way', 'Practice skills will be listed here, each with a download and an example prompt.'),
  );
  if (window.location.hash) focusTarget();
  window.addEventListener('hashchange', focusTarget);
}

start();
