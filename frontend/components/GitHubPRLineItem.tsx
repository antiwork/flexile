"use client";

import { GitMerge, GitPullRequest, RotateCcw } from "lucide-react";
import React from "react";
import { GitHubPRHoverCard, type PaidInvoiceInfo } from "@/components/GitHubPRHoverCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import type { PRDetails } from "@/utils/github";

interface GitHubPRLineItemProps {
  pr: PRDetails;
  error?: string | null;
  onRetry?: () => void;
  onClick?: () => void;
  className?: string;
  /** Current user's GitHub username for verification display */
  currentUserGitHubUsername?: string | null;
  /** List of invoices where this PR was previously paid */
  paidInvoices?: PaidInvoiceInfo[];
  /** Show amber status dot for items needing attention */
  showStatusDot?: boolean;
  /** Whether hover card is enabled (default true) */
  hoverCardEnabled?: boolean;
}

/**
 * Renders a prettified GitHub PR line item
 * Shows: [Icon] repo Title... #123 [Bounty Badge] [Status Dot]
 */
export function GitHubPRLineItem({
  pr,
  error,
  onRetry,
  onClick,
  className,
  currentUserGitHubUsername,
  paidInvoices = [],
  showStatusDot = false,
  hoverCardEnabled = true,
}: GitHubPRLineItemProps) {
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

  const isMerged = pr.state === "merged";
  const Icon = isMerged ? GitMerge : GitPullRequest;

  // Truncate title but preserve PR number
  const maxTitleLength = 40;
  const truncatedTitle =
    pr.title.length > maxTitleLength ? `${pr.title.substring(0, maxTitleLength).trim()}...` : pr.title;

  const content = (
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
      {showStatusDot ? (
        <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-label="Needs attention" />
      ) : null}
    </button>
  );

  return (
    <GitHubPRHoverCard
      pr={pr}
      currentUserGitHubUsername={currentUserGitHubUsername}
      paidInvoices={paidInvoices}
      enabled={hoverCardEnabled}
    >
      {content}
    </GitHubPRHoverCard>
  );
}

export default GitHubPRLineItem;
