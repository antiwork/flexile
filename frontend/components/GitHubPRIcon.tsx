"use client";

import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from "lucide-react";
import { cn } from "@/utils";
import type { PRState } from "@/utils/github";

const PR_STATE_ICONS: Record<PRState, React.ComponentType<{ className?: string }>> = {
  merged: GitMerge,
  closed: GitPullRequestClosed,
  draft: GitPullRequestDraft,
  open: GitPullRequest,
};

// Use explicit classes so Tailwind doesn't purge them
const PR_STATE_COLORS: Record<PRState, string> = {
  merged: "text-purple-500",
  closed: "text-red-500",
  draft: "text-gray-500",
  open: "text-green-500",
};

interface GitHubPRIconProps {
  state: PRState;
  className?: string;
}

export function GitHubPRIcon({ state, className }: GitHubPRIconProps) {
  const Icon = PR_STATE_ICONS[state];
  const colorClass = PR_STATE_COLORS[state];

  return <Icon className={cn("size-4 shrink-0", colorClass, className)} />;
}

export default GitHubPRIcon;
