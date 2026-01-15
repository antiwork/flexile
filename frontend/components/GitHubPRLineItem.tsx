"use client";

import { RotateCcw } from "lucide-react";
import React from "react";
import { GitHubPRHoverCard, type PaidInvoiceInfo } from "@/components/GitHubPRHoverCard";
import { GitHubPRIcon } from "@/components/GitHubPRIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { type PRDetails, truncatePRTitle } from "@/utils/github";

interface GitHubPRLineItemProps {
  pr: PRDetails;
  error?: string | null;
  onRetry?: () => void;
  onClick?: () => void;
  className?: string;
  currentUserGitHubUsername?: string | null;
  paidInvoices?: PaidInvoiceInfo[];
  showStatusDot?: boolean;
  hoverCardEnabled?: boolean;
}

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

  const truncatedTitle = truncatePRTitle(pr.title, 40);

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
      <GitHubPRIcon state={pr.state} />
      <span className="text-muted-foreground shrink-0">{pr.repo}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{truncatedTitle}</span>
        <span className="text-muted-foreground ml-1">#{pr.number}</span>
      </span>
      {pr.bounty_cents ? (
        <Badge variant="secondary" className="text-foreground shrink-0 bg-black/[0.03] dark:bg-white/[0.08]">
          {formatMoneyFromCents(pr.bounty_cents, { compact: true })}
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
