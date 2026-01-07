"use client";

import { CircleDot, ExternalLink, GitMerge, GitPullRequest, XCircle } from "lucide-react";
import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { Badge } from "./ui/badge";

interface GithubPRLinkProps {
  url: string;
  invoiceId?: string;
  onEdit?: () => void;
  onBountyResolved?: (amount: number) => void;
}

export function GithubPRLink({ url, invoiceId, onEdit, onBountyResolved }: GithubPRLinkProps) {
  const {
    data: pr,
    isLoading,
    error,
  } = trpc.github.getPullRequest.useQuery(
    { url, invoiceId },
    {
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  );

  React.useEffect(() => {
    if (pr && "bountyAmount" in pr && pr.bountyAmount && onBountyResolved) {
      onBountyResolved(pr.bountyAmount);
    }
  }, [pr, onBountyResolved]);

  if (isLoading) {
    return <div className="text-muted-foreground animate-pulse text-sm">Loading details...</div>;
  }

  if (error || !pr || "error" in pr) {
    const isPrivateError = pr && "error" in pr && pr.error === "not_found_or_private";
    const isPaid = pr && "error" in pr && pr.isPaid;
    return (
      <div className="flex items-center gap-2">
        <span className="truncate text-sm text-red-500">{url}</span>
        {isPaid ? (
          <Badge variant="secondary" className="bg-blue-100 text-[10px] text-blue-800 hover:bg-blue-100">
            Paid
          </Badge>
        ) : null}
        {isPrivateError ? (
          <Badge variant="destructive" className="text-[10px]">
            Private / No Access
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Invalid
          </Badge>
        )}
        {onEdit ? (
          <button onClick={onEdit} className="text-muted-foreground text-xs hover:underline">
            Edit
          </button>
        ) : null}
      </div>
    );
  }

  const { title, state, merged, number, owner, repo, bountyAmount, isPaid, isVerified, author, type } = pr;
  const isMerged = merged;
  const isClosed = state === "closed" && !merged;
  const isOpenState = state === "open";
  const isPR = type === "pull";

  const Icon = isPR ? (
    isMerged ? (
      <GitMerge className="size-4 text-purple-600" />
    ) : isClosed ? (
      <XCircle className="size-4 text-red-600" />
    ) : (
      <GitPullRequest className="size-4 text-green-600" />
    )
  ) : (
    <CircleDot className={cn("size-4", isOpenState ? "text-green-600" : "text-purple-600")} />
  );

  return (
    <div className="group relative flex items-center gap-2">
      <HoverCard openDelay={300} closeDelay={150}>
        <HoverCardTrigger asChild>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card hover:bg-accent/50 flex max-w-[360px] items-center gap-2 rounded-md border p-2 text-sm transition-colors"
            onClick={(e) => {
              if (!onEdit || e.metaKey || e.ctrlKey) return; // Allow opening in new tab
              e.preventDefault();
              onEdit?.();
            }}
          >
            {Icon}
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-medium">
                {owner}/{repo}#{number}
              </span>
              <span className="text-muted-foreground line-clamp-2 text-xs">{title}</span>
            </div>
            {bountyAmount ? (
              <Badge variant="secondary" className="ml-auto shrink-0 bg-green-100 text-green-800 hover:bg-green-100">
                ${bountyAmount}
              </Badge>
            ) : null}
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-semibold hover:underline"
              >
                {title}
              </a>
              {isPaid ? (
                <Badge variant="secondary" className="shrink-0 bg-blue-100 text-blue-800 hover:bg-blue-100">
                  Paid
                </Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="text-foreground font-medium">
                {owner}/{repo}
              </span>
              <span>•</span>
              <span>#{number}</span>
              <span>•</span>
              <span
                className={cn(
                  "font-medium capitalize",
                  isMerged ? "text-purple-600" : isOpenState ? "text-green-600" : "text-red-600",
                )}
              >
                {isMerged ? "Merged" : state}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {isVerified === false && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                  Unverified Author: @{author}
                </Badge>
              )}
              {isVerified === true && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                  Verified Author: @{author}
                </Badge>
              )}
              {bountyAmount ? (
                <Badge variant="secondary" className="bg-green-100 font-bold text-green-800 hover:bg-green-100">
                  💰 Bounty: ${bountyAmount}
                </Badge>
              ) : null}
            </div>

            <div className="pt-2">
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                View on GitHub <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>

      {isPaid ? (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Paid
        </Badge>
      ) : null}

      {isVerified === false && (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
          Unverified
        </Badge>
      )}

      {/* Edit button that appears on hover/focus of the container */}
      {onEdit ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="text-muted-foreground hover:text-foreground invisible p-1 group-hover:visible"
          aria-label="Edit link"
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}
