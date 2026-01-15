"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { GitHubStatusCard, type GitHubStatusType } from "@/components/GitHubStatusCard";
import { request } from "@/utils/request";
import { callback_github_path, installation_callback_github_path } from "@/utils/routes";

function GitHubCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GitHubStatusType>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const installationId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (error) {
      setStatus("error");
      setErrorMessage(searchParams.get("error_description") ?? "GitHub authorization was denied.");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state parameter.");
      return;
    }

    const exchangeCode = async () => {
      try {
        // First, exchange OAuth code for user authentication
        const response = await request({
          method: "POST",
          url: callback_github_path(),
          accept: "json",
          jsonData: { code, state },
        });

        if (!response.ok) {
          const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
          throw new Error(errorData.data?.error ?? "Failed to connect GitHub account");
        }

        // If this is a GitHub App installation (has installation_id)
        if (installationId && setupAction === "install") {
          // Process the installation
          const installResponse = await request({
            method: "POST",
            url: installation_callback_github_path(),
            accept: "json",
            jsonData: { installation_id: installationId, setup_action: setupAction, state, code },
          });

          if (!installResponse.ok) {
            const errorData = z.object({ error: z.string().optional() }).safeParse(await installResponse.json());
            throw new Error(errorData.data?.error ?? "Failed to process GitHub App installation");
          }
        }

        setStatus("success");

        // Notify opener window and close if this was opened as a popup
        if (window.opener) {
          try {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- window.opener is not typed correctly
            (window.opener as Window).postMessage({ type: "github-oauth-success" }, window.location.origin);
          } catch {
            // Cross-origin access may fail, but that's ok
          }
          // Small delay before closing to ensure message is sent
          setTimeout(() => window.close(), 100);
        } else if (installationId) {
          // If installation and not a popup, redirect to integrations
          setTimeout(() => {
            window.location.href = "/settings/administrator/integrations";
          }, 1000);
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    void exchangeCode();
  }, [searchParams]);

  return <GitHubStatusCard status={status} errorMessage={errorMessage} />;
}

export default function GitHubCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<GitHubStatusCard status="loading" />}>
        <GitHubCallbackContent />
      </Suspense>
    </div>
  );
}
