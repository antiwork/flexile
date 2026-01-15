"use client";

import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from "lucide-react";
import { cn } from "@/utils";
import { getPRStateStyle, type PRState } from "@/utils/github";

const PR_STATE_ICONS: Record<PRState, React.ComponentType<{ className?: string }>> = {
  merged: GitMerge,
  closed: GitPullRequestClosed,
  draft: GitPullRequestDraft,
  open: GitPullRequest,
};

interface GitHubPRIconProps {
  state: PRState;
  className?: string;
}

export function GitHubPRIcon({ state, className }: GitHubPRIconProps) {
  const Icon = PR_STATE_ICONS[state];
  const style = getPRStateStyle(state);

  return <Icon className={cn("size-4 shrink-0", style.color, className)} aria-label={style.label} />;
}

export default GitHubPRIcon;
