"use client";

import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface PrBadgeProps {
  prUrl: string;
  prData?: any;
  bountyAmount?: number;
  isPaid?: boolean;
}

export default function PrBadge({ prUrl, prData, bountyAmount, isPaid }: PrBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!prData) {
    return (
      <Badge variant="secondary" className="ml-2">
        PR
      </Badge>
    );
  }

  const isMerged = prData.merged;
  const title = prData.title;
  const number = prData.number;
  const bountyText = bountyAmount ? `$${bountyAmount}` : null;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant={isMerged ? "default" : "destructive"}
          className="ml-2 cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isMerged ? (
            <CheckCircleIcon className="w-3 h-3 mr-1" />
          ) : (
            <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
          )}
          PR #{number}
          {bountyText && <span className="ml-1 font-bold">{bountyText}</span>}
          {isPaid && <span className="ml-1">(Paid)</span>}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pull Request #{number}</CardTitle>
            <CardDescription>
              <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                View on GitHub
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">{title}</p>
            <div className="flex items-center gap-2">
              <Badge variant={isMerged ? "default" : "destructive"}>
                {isMerged ? "Merged" : "Open"}
              </Badge>
              {bountyText && (
                <Badge variant="outline">
                  Bounty: {bountyText}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </HoverCardContent>
    </HoverCard>
  );
}