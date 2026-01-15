"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/utils/request";
import { connect_company_github_path, installation_callback_github_path } from "@/utils/routes";

function GitHubInstallationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "select_org">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ login: string; id: number; avatar_url: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<{ login: string; id: number } | null>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

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

        const responseBody = await response.json();

        if (!response.ok) {
          const errorMsg = responseBody?.error ?? "Failed to process GitHub App installation";
          throw new Error(errorMsg);
        }

        const data = z
          .object({
            success: z.boolean(),
            installation_id: z.string(),
            company_id: z.string().optional(),
            auto_connected: z.boolean().optional(),
            org_name: z.string().optional(),
            orgs: z
              .array(
                z.object({
                  login: z.string(),
                  id: z.number(),
                  avatar_url: z.string(),
                }),
              )
              .optional(),
          })
          .parse(responseBody);

        setInstallationId(data.installation_id);
        if (data.company_id) {
          setCompanyId(data.company_id);
        }

        // If auto-connected (single org), go directly to success
        if (data.auto_connected) {
          setStatus("success");
          setTimeout(() => {
            window.location.href = "/settings/administrator/integrations";
          }, 1500);
          return;
        }

        if (data.orgs && data.orgs.length > 0) {
          setOrganizations(data.orgs);
          setStatus("select_org");
        } else {
          setStatus("success");
          setTimeout(() => {
            window.location.href = "/settings/administrator/integrations";
          }, 2000);
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    };

    void processInstallation();
  }, [searchParams, router]);

  const handleConfirmOrg = async () => {
    if (!selectedOrg || !installationId || !companyId) {
      setStatus("error");
      setErrorMessage("Missing required information. Please try connecting again.");
      return;
    }

    try {
      const response = await request({
        method: "POST",
        url: connect_company_github_path(companyId),
        accept: "json",
        jsonData: {
          github_org_name: selectedOrg.login,
          github_org_id: selectedOrg.id,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to connect organization");
      }

      setStatus("success");
      setTimeout(() => {
        window.location.href = "/settings/administrator/integrations";
      }, 1000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect organization");
    }
  };

  if (status === "select_org") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>Which organization did you install the GitHub App on?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => setSelectedOrg(org)}
              className={`hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selectedOrg?.id === org.id ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <Image src={org.avatar_url} alt="" width={32} height={32} className="rounded-full" />
              <span className="font-medium">{org.login}</span>
            </button>
          ))}
          <button
            onClick={() => void handleConfirmOrg()}
            disabled={!selectedOrg}
            className="text-primary bg-primary text-primary-foreground w-full rounded-lg px-4 py-2 disabled:opacity-50"
          >
            Connect Organization
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {status === "loading" && "Processing GitHub App Installation..."}
          {status === "success" && "GitHub App Installed!"}
          {status === "error" && "Installation Failed"}
        </CardTitle>
        <CardDescription>
          {status === "loading" && "Please wait while we set up your GitHub integration."}
          {status === "success" && "Your GitHub App has been installed. Redirecting you back to settings..."}
          {status === "error" && errorMessage}
        </CardDescription>
      </CardHeader>
      {status === "error" && (
        <CardContent>
          <button
            onClick={() => router.push("/settings/administrator/integrations")}
            className="text-primary text-sm underline hover:no-underline"
          >
            Go back to settings
          </button>
        </CardContent>
      )}
    </Card>
  );
}

function GitHubInstallationLoading() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Processing GitHub App Installation...</CardTitle>
        <CardDescription>Please wait while we set up your GitHub integration.</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function GitHubInstallationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<GitHubInstallationLoading />}>
        <GitHubInstallationContent />
      </Suspense>
    </div>
  );
}
