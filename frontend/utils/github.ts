/**
 * GitHub utility functions for PR URL parsing and detection
 */

// Regex to match GitHub PR URLs
// Matches: https://github.com/owner/repo/pull/123
const GITHUB_PR_URL_REGEX = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/u;

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  number: number;
  fullRepo: string; // owner/repo
}

/**
 * Check if a string is a valid GitHub PR URL
 */
export function isGitHubPRUrl(text: string): boolean {
  return GITHUB_PR_URL_REGEX.test(text.trim());
}

/**
 * Parse a GitHub PR URL into its components
 * Returns null if the URL is not a valid GitHub PR URL
 */
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

/**
 * Check if a line item description contains only a GitHub PR URL
 * This helps determine if we should prettify the display
 */
export function isOnlyGitHubPRUrl(description: string): boolean {
  const trimmed = description.trim();
  return isGitHubPRUrl(trimmed);
}

/**
 * Extract GitHub PR URL from a description if it contains one
 * Returns null if no PR URL is found
 */
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

/**
 * Format a PR for display in a line item
 * Shows: "Title... #123" with the title truncated if needed
 */
export function formatPRDisplay(pr: PRDetails, maxTitleLength = 50): string {
  const truncatedTitle =
    pr.title.length > maxTitleLength ? `${pr.title.substring(0, maxTitleLength).trim()}...` : pr.title;
  return `${truncatedTitle} #${pr.number}`;
}
