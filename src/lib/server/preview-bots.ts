/**
 * Link previewers, unfurlers, crawlers and command-line clients that fetch a URL on their own
 * (when a link is pasted in Slack/Zalo/Messenger/LinkedIn/iMessage, by search engines, ...).
 * `/i/<token>` must not exchange the token for them: otherwise the preview, not the person,
 * "opens" the invite (an `open` event and a session nobody uses).
 *
 * Case-insensitive regex fragments, matched anywhere in the User-Agent. Keep it to
 * previewers/crawlers/CLI clients: never generic headless browsers, and never anything that
 * matches a real in-app browser (Zalo's in-app browser says "Zalo android/..", "ZaloTheme/..",
 * "ZaloLanguage/..", hence the lookahead; Pinterest's app says "Pinterest for ..", hence only
 * its crawler names).
 *
 * NEEDS UPKEEP: previewers change their User-Agent over time and new ones appear. Scanners that
 * pretend to be a normal browser (some email gateways) cannot be told apart and still count as
 * an open (documented on /admin and in docs/RUNBOOK.md).
 */
export const PREVIEW_BOT_PATTERNS: readonly string[] = [
  "slackbot",
  "slack-imgproxy",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "zalo(?!\\s*(?:android|ios|iphone|ipad)|theme|language)",
  "skypeuripreview",
  "microsoftpreview",
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "bingpreview",
  "applebot",
  "pinterestbot",
  "pinterest/0\\.",
  "embedly",
  "mastodon",
  "signal",
  "redditbot",
  "vkshare",
  "quora link preview",
  "outbrain",
  "tumblr",
  "line-poker",
  "yandex",
  "baiduspider",
  "duckduckbot",
  "curl/",
  "wget/",
  "python-requests",
  "go-http-client",
];

const PREVIEW_BOT_RE = new RegExp(PREVIEW_BOT_PATTERNS.join("|"), "i");

/** True when the User-Agent belongs to a known previewer/crawler/CLI client. A missing UA is not one. */
export function isPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && PREVIEW_BOT_RE.test(userAgent);
}
