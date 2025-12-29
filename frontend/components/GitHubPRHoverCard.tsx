"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { CheckCircle2, CircleAlert, GitMerge, GitPullRequest } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { PRDetails } from "@/utils/github";

const LONG_PRESS_DURATION = 500; // ms

export interface PaidInvoiceInfo {
  invoiceId: string;
  invoiceNumber: string;
}

export interface GitHubPRHoverCardProps {
  pr: PRDetails;
  /** The GitHub username of the current user (for verification) */
  currentUserGitHubUsername?: string | null | undefined;
  /** List of invoices where this PR was previously paid */
  paidInvoices?: PaidInvoiceInfo[];
  children: React.ReactNode;
  /** Whether to show the hover card (default true) */
  enabled?: boolean;
}

/**
 * Hover card that shows detailed PR information
 * - Open delay: 300ms
 * - Close delay: 150ms
 * - Max width: 360px
 */
export function GitHubPRHoverCard({
  pr,
  currentUserGitHubUsername,
  paidInvoices = [],
  children,
  enabled = true,
}: GitHubPRHoverCardProps) {
  const [open, setOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setOpen(true);
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (!enabled) {
    return children;
  }

  const isMerged = pr.state === "merged";
  const isVerified = currentUserGitHubUsername
    ? pr.author.toLowerCase() === currentUserGitHubUsername.toLowerCase()
    : null;

  return (
    <HoverCardPrimitive.Root openDelay={300} closeDelay={150} open={open} onOpenChange={setOpen}>
      <HoverCardPrimitive.Trigger
        asChild
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {children}
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          className={cn(
            "bg-popover text-popover-foreground z-50 w-[360px] rounded-lg border p-4 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          )}
          sideOffset={5}
          align="start"
        >
          <div className="grid gap-3">
            {/* Header: repo · author */}
            <div className="text-muted-foreground text-sm">
              {pr.repo} · {pr.author}
            </div>

            {/* Title and PR number */}
            <div>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                <span className="line-clamp-2 font-semibold">{pr.title}</span>
                <span className="text-muted-foreground ml-1">#{pr.number}</span>
              </a>
            </div>

            {/* Status badge */}
            <div>
              {isMerged ? (
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  <GitMerge className="mr-1 size-3" />
                  Merged
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <GitPullRequest className="mr-1 size-3" />
                  Open
                </Badge>
              )}
            </div>

            {/* Paid status */}
            {paidInvoices.length > 0 ? (
              <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-white">
                  <span className="text-[10px] font-bold">$</span>
                </span>
                <span>
                  Paid on invoice{" "}
                  {paidInvoices.map((invoice, index) => (
                    <React.Fragment key={invoice.invoiceId}>
                      {index > 0 && (index === paidInvoices.length - 1 ? " and " : ", ")}
                      <Link href={`/invoices/${invoice.invoiceId}`} className="text-foreground hover:underline">
                        #{invoice.invoiceNumber}
                      </Link>
                    </React.Fragment>
                  ))}
                  .
                </span>
              </div>
            ) : null}

            {/* Verification status */}
            {isVerified !== null ? (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  isVerified ? "text-green-600" : "text-muted-foreground",
                )}
              >
                {isVerified ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>
                      <span className="font-medium">Verified</span> author of this pull request.
                    </span>
                  </>
                ) : (
                  <>
                    <CircleAlert className="size-4" />
                    <span>Unverified author of this pull request.</span>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <HoverCardPrimitive.Arrow className="fill-popover" />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

export default GitHubPRHoverCard;
