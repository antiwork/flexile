"use client";

import React, { useCallback, useState } from "react";
import { z } from "zod";
import { GitHubIntegrationCard } from "@/components/GitHubIntegrationCard";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { app_installation_url_github_path, disconnect_company_github_path } from "@/utils/routes";

export default function IntegrationsPage() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Integrations</h2>
        <p className="text-muted-foreground text-base">Connect Flexile to your company's favorite tools.</p>
      </hgroup>
      <GitHubIntegrationSection />
    </div>
  );
}

const GitHubIntegrationSection = () => {
  const company = useCurrentCompany();
  const [isLoadingConnect, setIsLoadingConnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    setIsLoadingConnect(true);

    try {
      const response = await request({
        method: "GET",
        url: app_installation_url_github_path(),
        accept: "json",
      });

      if (!response.ok) {
        throw new Error("Failed to get GitHub App installation URL");
      }

      const data = z.object({ url: z.string() }).parse(await response.json());

      window.location.href = data.url;
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Failed to connect GitHub");
      setIsLoadingConnect(false);
    }
  }, []);

  return (
    <GitHubIntegrationCard
      connectedIdentifier={company.githubOrgName}
      description="Automatically verify contractor pull requests and bounty claims."
      disconnectEndpoint={disconnect_company_github_path(company.id)}
      disconnectModalTitle="Disconnect GitHub organization?"
      disconnectModalDescription="This will prevent contractors from verifying Pull Request ownership and disable automatic bounty checks."
      disconnectButtonText="Disconnect"
      onConnect={handleConnect}
      isConnecting={isLoadingConnect}
      connectError={connectError}
    />
  );
};
