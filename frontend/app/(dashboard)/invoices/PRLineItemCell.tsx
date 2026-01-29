"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import React from "react";
import { z } from "zod";
import { GitHubPRLineItem } from "@/components/GitHubPRLineItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isGitHubPRUrl, parseGitHubPRUrl, parsePRState, type PRDetails, prDetailsSchema } from "@/utils/github";
import { request } from "@/utils/request";
import { pr_github_path } from "@/utils/routes";

interface PRLineItemCellProps {
  description: string;
  storedPRData: {
    url: string | null;
    number: number | null;
    title: string | null;
    state: string | null;
    author: string | null;
    repo: string | null;
    bounty_cents: number | null;
  };
  githubUsername: string | null;
  companyGithubOrg: string | null;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  hasError: boolean;
}

export const PRLineItemCell = ({
  description,
  storedPRData,
  githubUsername,
  companyGithubOrg,
  isEditing,
  onEdit,
  onChange,
  onBlur,
  hasError,
}: PRLineItemCellProps) => {
  const hasPRUrl = isGitHubPRUrl(description);
  const parsedPR = hasPRUrl ? parseGitHubPRUrl(description) : null;
  const isCompanyOrgPR =
    parsedPR && companyGithubOrg && parsedPR.owner.toLowerCase() === companyGithubOrg.toLowerCase();

  const shouldFetch = Boolean(hasPRUrl && isCompanyOrgPR && githubUsername && !storedPRData.url);

  const {
    data: prDetails,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pr-details", description],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: `${pr_github_path()}?url=${encodeURIComponent(description)}`,
        accept: "json",
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to fetch PR details");
      }

      const data = z.object({ pr: prDetailsSchema }).parse(await response.json());
      return data.pr;
    },
    enabled: shouldFetch,
    staleTime: Infinity,
  });

  const displayPR: PRDetails | null =
    prDetails ??
    (storedPRData.url
      ? {
          url: storedPRData.url,
          number: storedPRData.number ?? 0,
          title: storedPRData.title ?? "",
          state: parsePRState(storedPRData.state),
          author: storedPRData.author ?? "",
          repo: storedPRData.repo ?? "",
          bounty_cents: storedPRData.bounty_cents,
        }
      : null);

  if (!isEditing && displayPR && hasPRUrl) {
    return (
      <GitHubPRLineItem
        pr={displayPR}
        error={error?.message ?? null}
        onRetry={() => void refetch()}
        onClick={onEdit}
        currentUserGitHubUsername={githubUsername}
        hoverCardEnabled
      />
    );
  }

  return (
    <div className="relative flex items-center">
      <Input
        value={description}
        placeholder="Description or GitHub PR link..."
        aria-invalid={hasError}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onEdit}
        onBlur={onBlur}
        className={isFetching ? "pr-8" : error ? "pr-20" : ""}
      />
      {isFetching ? (
        <span className="animate-in fade-in absolute right-2 [animation-delay:300ms] [animation-fill-mode:forwards]">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </span>
      ) : null}
      {error && !isFetching ? (
        <Button
          variant="link"
          size="small"
          className="text-muted-foreground absolute right-1 h-auto gap-1 px-1"
          onClick={() => void refetch()}
        >
          <RotateCcw className="size-3" />
          Retry
        </Button>
      ) : null}
    </div>
  );
};
