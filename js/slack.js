/*
 * slack.js. The one place that builds Slack deep links. Before this file the same logic was copied in layout.js,
 * vote.js and home-cards.js. Both builders return '' unless every one of these holds, so callers just test the
 * result for truthiness and draw nothing (no gap) when it is empty:
 *   - config.features.slackLinks is true (it stays false until Gate 4), and
 *   - the IDs they need are present (they come from the git-ignored content/*.local.json, never from the repo).
 * IDs are percent-encoded, so an odd character in data cannot change the link's shape. They never throw: a value
 * that cannot be encoded (a lone surrogate makes encodeURIComponent throw) gives '' like a missing ID.
 */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

function enabled(config) {
  return Boolean(config && config.features && config.features.slackLinks === true && config.slack);
}

function link(kind, team, id) {
  try {
    return `slack://${kind}?team=${encodeURIComponent(team)}&id=${encodeURIComponent(id)}`;
  } catch {
    return '';
  }
}

/** slack://channel?team=…&id=… for the practice channel, or ''. */
export function channelHref(config) {
  if (!enabled(config)) return '';
  const team = text(config.slack.teamId);
  const channel = text(config.slack.channelId);
  return team && channel ? link('channel', team, channel) : '';
}

/**
 * The same channel link without the feature flag, for the idea form's "Open Slack" button: it shows as soon as the
 * team and channel IDs are in config, and not before. (Slack's link needs both IDs; one alone cannot open the channel.)
 */
export function openChannelHref(config) {
  const slack = config && config.slack;
  if (!slack) return '';
  const team = text(slack.teamId);
  const channel = text(slack.channelId);
  return team && channel ? link('channel', team, channel) : '';
}

/** slack://user?team=…&id=… to open a direct message with one person, or ''. */
export function userHref(config, slackUserId) {
  if (!enabled(config)) return '';
  const team = text(config.slack.teamId);
  const user = text(slackUserId);
  return team && user ? link('user', team, user) : '';
}
