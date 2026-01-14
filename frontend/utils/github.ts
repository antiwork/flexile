// Matches: https://github.com/owner/repo/pull/123
const GITHUB_PR_URL_REGEX = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/u;

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  number: number;
  fullRepo: string; // owner/repo
}

export function isGitHubPRUrl(text: string): boolean {
  return GITHUB_PR_URL_REGEX.test(text.trim());
}

/** Returns null if the URL is invalid */
export function parseGitHubPRUrl(url: string): ParsedPRUrl | null {
  const match = GITHUB_PR_URL_REGEX.exec(url.trim());
  if (!match) return null;

  const [, owner, repo, numberStr] = match;
  const number = parseInt(numberStr ?? "", 10);

  if (!owner || !repo || isNaN(number)) return null;

  return {
    owner,
    repo,
    number,
    fullRepo: `${owner}/${repo}`,
  };
}

export function isOnlyGitHubPRUrl(description: string): boolean {
  return isGitHubPRUrl(description.trim());
}

export function extractGitHubPRUrl(description: string): string | null {
  const match = GITHUB_PR_URL_REGEX.exec(description);
  return match ? match[0] : null;
}

export interface PRDetails {
  url: string;
  number: number;
  title: string;
  state: "open" | "merged" | "closed";
  author: string;
  repo: string;
  bounty_cents: number | null;
}

export function parsePRState(state: string | null | undefined): PRDetails["state"] {
  if (state === "open" || state === "merged" || state === "closed") return state;
  return "open";
}

export function truncatePRTitle(title: string, maxLength = 50): string {
  return title.length > maxLength ? `${title.substring(0, maxLength).trim()}...` : title;
}

export function formatPRDisplay(pr: PRDetails, maxTitleLength = 50): string {
  return `${truncatePRTitle(pr.title, maxTitleLength)} #${pr.number}`;
}
