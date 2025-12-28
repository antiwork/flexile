"use client";

import { useState } from "react";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon, XCircleIcon, ExternalLinkIcon } from "lucide-react";

interface GitHubPRData {
  number: number;
  title: string;
  author: string;
  mergedAt: string | null;
  state: string;
  url: string;
  repo: string;
  bountyCents: number | null;
  alreadyPaid: boolean;
  verified: boolean;
}

interface GitHubPRLineItemProps {
  prData: GitHubPRData;
  showPaidBadge?: boolean;
}

export function GitHubPRLineItem({ prData, showPaidBadge = true }: GitHubPRLineItemProps) {
  const isMerged = !!prData.mergedAt;
  const truncatedTitle = prData.title.length > 50 
    ? prData.title.substring(0, 50) + "..." 
    : prData.title;

  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* PR Icon */}
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z" />
            </svg>
            
            {/* Title (truncated) */}
            <span className="truncate text-sm text-gray-900 group-hover:text-blue-600">
              {truncatedTitle}
            </span>
            
            {/* PR Number (never truncated) */}
            <span className="text-sm text-gray-500 flex-shrink-0">
              #{prData.number}
            </span>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Merged Status */}
            <Badge variant={isMerged ? "default" : "secondary"} className="text-xs">
              {isMerged ? (
                <>
                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                  Merged
                </>
              ) : (
                <>
                  <XCircleIcon className="w-3 h-3 mr-1" />
                  Open
                </>
              )}
            </Badge>

            {/* Bounty Badge */}
            {prData.bountyCents && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                💎 {formatMoneyFromCents(prData.bountyCents)}
              </Badge>
            )}

            {/* Paid Badge */}
            {showPaidBadge && prData.alreadyPaid && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Paid
              </Badge>
            )}

            {/* Verified Badge */}
            {prData.verified && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </div>
      </HoverCardTrigger>

      <HoverCardContent className="w-[360px]" side="top">
        <GitHubPRHoverCard prData={prData} />
      </HoverCardContent>
    </HoverCard>
  );
}

interface GitHubPRHoverCardProps {
  prData: GitHubPRData;
}

export function GitHubPRHoverCard({ prData }: GitHubPRHoverCardProps) {
  const isMerged = !!prData.mergedAt;

  return (
    <div className="space-y-3">
      {/* Header with PR icon and repo */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z" />
        </svg>
        <span>{prData.repo}</span>
      </div>

      {/* Title - clickable, max 2 lines with ellipsis */}
      <a
        href={prData.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
      >
        {prData.title} <span className="text-gray-500">#{prData.number}</span>
        <ExternalLinkIcon className="inline-block w-3 h-3 ml-1 opacity-50" />
      </a>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>by @{prData.author}</span>
        <span>•</span>
        <Badge variant={isMerged ? "default" : "secondary"} className="text-xs">
          {isMerged ? "Merged" : "Open"}
        </Badge>
        {prData.bountyCents && (
          <>
            <span>•</span>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              💎 {formatMoneyFromCents(prData.bountyCents)}
            </Badge>
          </>
        )}
      </div>

      {/* Merged date */}
      {isMerged && (
        <div className="text-xs text-gray-500">
          Merged on {new Date(prData.mergedAt!).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

export default GitHubPRLineItem;
