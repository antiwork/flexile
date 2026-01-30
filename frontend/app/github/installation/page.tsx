"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { GitHubStatusCard, type GitHubStatusType } from "@/components/GitHubStatusCard";
import { request } from "@/utils/request";
import { installation_callback_github_path } from "@/utils/routes";

function GitHubInstallationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<GitHubStatusType>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const installation_id = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");
    const state = searchParams.get("state");
    const code = searchParams.get("code");

    if (setupAction !== "install" || !installation_id) {
      setStatus("error");
      setErrorMessage("GitHub App installation was not completed.");
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage(
        'OAuth code not received. Please enable "Request user authorization (OAuth) during installation" in your GitHub App settings, then try connecting again.',
      );
      return;
    }

    const processInstallation = async () => {
      try {
        const response = await request({
          method: "POST",
          url: installation_callback_github_path(),
          accept: "json",
          jsonData: { installation_id, setup_action: setupAction, state, code },
        });

        const responseBody: unknown = await response.json();

        if (!response.ok) {
          const errorData = z.object({ error: z.string().optional() }).safeParse(responseBody);
          const errorMsg = errorData.success ? errorData.data.error : undefined;
          throw new Error(errorMsg ?? "Failed to process GitHub App installation");
        }

        z.object({
          success: z.boolean(),
          installation_id: z.string(),
          company_id: z.string().optional(),
          auto_connected: z.boolean().optional(),
          org_name: z.string().optional(),
        }).parse(responseBody);

        setStatus("success");
        setTimeout(() => {
          window.location.href = "/settings/administrator/integrations";
        }, 1500);
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    void processInstallation();
  }, [searchParams, router]);

  return (
    <GitHubStatusCard
      status={status}
      errorMessage={errorMessage}
      loadingTitle="Processing GitHub App Installation..."
      loadingDescription="Please wait while we set up your GitHub integration."
      successTitle="GitHub App Installed!"
      successDescription="Your GitHub App has been installed. Redirecting you back to settings..."
      errorTitle="Installation Failed"
      onClose={() => router.push("/settings/administrator/integrations")}
    />
  );
}

export default function GitHubInstallationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense
        fallback={
          <GitHubStatusCard
            status="loading"
            loadingTitle="Processing GitHub App Installation..."
            loadingDescription="Please wait while we set up your GitHub integration."
          />
        }
      >
        <GitHubInstallationContent />
      </Suspense>
    </div>
  );
}
