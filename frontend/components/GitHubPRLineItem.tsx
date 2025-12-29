"use client";

import { GitMerge, GitPullRequest, Loader2, RotateCcw } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import type { PRDetails } from "@/utils/github";

interface GitHubPRLineItemProps {
  pr: PRDetails | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * Renders a prettified GitHub PR line item
 * Shows: [Icon] Title... #123 [Bounty Badge]
 */
export function GitHubPRLineItem({ pr, isLoading, error, onRetry, onClick, className }: GitHubPRLineItemProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground">Loading PR details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <span className="text-destructive">{error}</span>
        {onRetry ? (
          <Button variant="ghost" size="small" onClick={onRetry} className="h-auto p-1">
            <RotateCcw className="size-3" />
            <span className="text-xs">Retry</span>
          </Button>
        ) : null}
      </div>
    );
  }

  if (!pr) {
    return null;
  }

  const isMerged = pr.state === "merged";
  const Icon = isMerged ? GitMerge : GitPullRequest;

  // Truncate title but preserve PR number
  const maxTitleLength = 40;
  const truncatedTitle =
    pr.title.length > maxTitleLength ? `${pr.title.substring(0, maxTitleLength).trim()}...` : pr.title;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 cursor-text items-center gap-2 text-left text-sm",
        "hover:bg-accent/50 -mx-2 rounded px-2 py-1 transition-colors",
        className,
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", isMerged ? "text-purple-500" : "text-green-500")}
        aria-label={isMerged ? "Merged" : "Open"}
      />
      <span className="text-muted-foreground shrink-0">{pr.repo}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{truncatedTitle}</span>
        <span className="text-muted-foreground ml-1">#{pr.number}</span>
      </span>
      {pr.bounty_cents ? (
        <Badge
          variant="secondary"
          className="shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
        >
          {formatMoneyFromCents(pr.bounty_cents)}
        </Badge>
      ) : null}
    </button>
  );
}

export default GitHubPRLineItem;
