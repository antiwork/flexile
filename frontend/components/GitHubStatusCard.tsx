"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type GitHubStatusType = "loading" | "success" | "error";

interface GitHubStatusCardProps {
  status: GitHubStatusType;
  errorMessage?: string | null;
  loadingTitle?: string;
  loadingDescription?: string;
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function GitHubStatusCard({
  status,
  errorMessage,
  loadingTitle = "Connecting GitHub...",
  loadingDescription = "Please wait while we connect your GitHub account.",
  successTitle = "GitHub Connected!",
  successDescription = "Your GitHub account has been connected. This window will close automatically, or you may close it manually.",
  errorTitle = "Connection Failed",
  onClose,
  showCloseButton = true,
}: GitHubStatusCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {status === "loading" && loadingTitle}
          {status === "success" && successTitle}
          {status === "error" && errorTitle}
        </CardTitle>
        <CardDescription>
          {status === "loading" && loadingDescription}
          {status === "success" && successDescription}
          {status === "error" && errorMessage}
        </CardDescription>
      </CardHeader>
      {showCloseButton && (status === "error" || status === "success") ? (
        <CardContent>
          <button
            onClick={onClose ?? (() => window.close())}
            className="text-primary text-sm underline hover:no-underline"
          >
            {onClose ? "Go back to settings" : "Close this window"}
          </button>
        </CardContent>
      ) : null}
    </Card>
  );
}
