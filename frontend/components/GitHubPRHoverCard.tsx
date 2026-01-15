"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { BadgeDollarSign, CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import { getPRStateStyle, type PRDetails } from "@/utils/github";

const LONG_PRESS_DURATION = 500;

export interface PaidInvoiceInfo {
  invoiceId: string;
  invoiceNumber: string;
}

export interface GitHubPRHoverCardProps {
  pr: PRDetails;
  currentUserGitHubUsername?: string | null | undefined;
  paidInvoices?: PaidInvoiceInfo[];
  children: React.ReactNode;
  enabled?: boolean;
}

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

  const isVerified = currentUserGitHubUsername
    ? pr.author.toLowerCase() === currentUserGitHubUsername.toLowerCase()
    : null;

  const stateStyle = getPRStateStyle(pr.state);

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
            "bg-popover text-popover-foreground z-50 w-[360px] rounded-lg border border-black/[0.18] p-4 shadow-sm dark:border-white/10",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          )}
          sideOffset={5}
          align="start"
        >
          <div className="group grid cursor-pointer gap-3">
            <div className="text-muted-foreground text-sm">
              {pr.repo} · {pr.author}
            </div>

            <div>
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                <span className="font-semibold group-hover:text-blue-600 group-hover:underline">{pr.title}</span>
                <span className="text-muted-foreground ml-1 font-normal">#{pr.number}</span>
              </a>
            </div>

            <div>
              <Badge className={stateStyle.badgeClassName}>{stateStyle.label}</Badge>
            </div>

            {isVerified !== null ? (
              <div className="flex items-center gap-1.5 text-sm">
                {isVerified ? (
                  <>
                    <CheckCircle2 className="size-4 text-green-600" />
                    <span>
                      <span className="font-medium text-green-600">Verified author</span>
                      <span className="text-muted-foreground"> of this pull request.</span>
                    </span>
                  </>
                ) : (
                  <>
                    <CircleAlert className="text-muted-foreground size-4" />
                    <span className="text-muted-foreground">Unverified author of this pull request.</span>
                  </>
                )}
              </div>
            ) : null}

            {paidInvoices.length > 0 ? (
              <div className="flex items-center gap-1.5 text-sm">
                <BadgeDollarSign className="size-4 text-blue-600" />
                <span>
                  <span className="font-medium text-blue-600">Paid</span>
                  <span className="text-muted-foreground"> on invoice </span>
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
          </div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

export default GitHubPRHoverCard;
