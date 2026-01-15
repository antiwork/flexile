import { z } from "zod";

const GITHUB_PR_URL_REGEX = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/u;

export const PR_STATES = ["open", "merged", "closed", "draft"] as const;
export type PRState = (typeof PR_STATES)[number];

export const prStateSchema = z.enum(PR_STATES);

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  number: number;
  fullRepo: string;
}

export function isGitHubPRUrl(text: string): boolean {
  return GITHUB_PR_URL_REGEX.test(text.trim());
}

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
  state: PRState;
  author: string;
  repo: string;
  bounty_cents: number | null;
}

export const prDetailsSchema = z.object({
  url: z.string(),
  number: z.number(),
  title: z.string(),
  state: prStateSchema,
  author: z.string(),
  repo: z.string(),
  bounty_cents: z.number().nullable(),
});

export function parsePRState(state: string | null | undefined): PRState {
  const result = prStateSchema.safeParse(state);
  return result.success ? result.data : "open";
}

export function truncatePRTitle(title: string, maxLength = 50): string {
  return title.length > maxLength ? `${title.substring(0, maxLength).trim()}...` : title;
}

export function formatPRDisplay(pr: PRDetails, maxTitleLength = 50): string {
  return `${truncatePRTitle(pr.title, maxTitleLength)} #${pr.number}`;
}

export interface PRStateStyle {
  color: string;
  label: string;
  badgeClassName: string;
}

export const PR_STATE_STYLES: Record<PRState, PRStateStyle> = {
  merged: {
    color: "text-purple-500",
    label: "Merged",
    badgeClassName: "rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  closed: {
    color: "text-red-500",
    label: "Closed",
    badgeClassName: "rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  draft: {
    color: "text-gray-500",
    label: "Draft",
    badgeClassName: "rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  open: {
    color: "text-green-500",
    label: "Open",
    badgeClassName: "rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
};

export function getPRStateStyle(state: PRState): PRStateStyle {
  return PR_STATE_STYLES[state];
}
