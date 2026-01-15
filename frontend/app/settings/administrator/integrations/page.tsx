"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany } from "@/global";
import githubMark from "@/images/github-mark.svg";
import { request } from "@/utils/request";
import {
  app_installation_url_github_path,
  connect_company_github_path,
  disconnect_company_github_path,
  oauth_url_github_path,
  orgs_github_path,
} from "@/utils/routes";

interface GitHubOrg {
  login: string;
  id: number;
  avatar_url: string;
}

const orgsResponseSchema = z.object({
  orgs: z.array(
    z.object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
    }),
  ),
});

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
  const queryClient = useQueryClient();
  const [isOrgSelectorOpen, setIsOrgSelectorOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [organizations, setOrganizations] = useState<GitHubOrg[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<GitHubOrg | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  const fetchOrganizations = useCallback(async (): Promise<GitHubOrg[]> => {
    const response = await request({
      method: "GET",
      url: orgs_github_path(),
      accept: "json",
    });

    if (!response.ok) {
      const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
      throw new Error(errorData.data?.error ?? "Failed to fetch organizations");
    }

    const data = orgsResponseSchema.parse(await response.json());
    return data.orgs;
  }, []);

  const connectMutation = useMutation({
    mutationFn: async (org: GitHubOrg) => {
      const response = await request({
        method: "POST",
        url: connect_company_github_path(company.id),
        accept: "json",
        jsonData: { github_org_name: org.login, github_org_id: org.id },
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to connect GitHub organization");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setIsOrgSelectorOpen(false);
      setSelectedOrg(null);
    },
  });

  const triggerOAuthPopup = useCallback(async () => {
    const response = await request({
      method: "GET",
      url: oauth_url_github_path({ include_orgs: "true" }),
      accept: "json",
    });

    if (!response.ok) {
      throw new Error("Failed to get OAuth URL");
    }

    const data = z.object({ url: z.string() }).parse(await response.json());

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    return new Promise<void>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<unknown>) => {
        const messageData = event.data;
        if (
          typeof messageData === "object" &&
          messageData !== null &&
          "type" in messageData &&
          messageData.type === "github-oauth-success"
        ) {
          void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
          popup?.close();
          window.removeEventListener("message", handleMessage);
          resolve();
        }
      };

      window.addEventListener("message", handleMessage);

      // Poll for popup close (in case user closes it manually)
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", handleMessage);
          reject(new Error("OAuth popup was closed"));
        }
      }, 500);
    });
  }, [queryClient]);

  const handleConnect = useCallback(async () => {
    setOrgsError(null);
    setIsLoadingOrgs(true);
    connectMutation.reset();

    try {
      // Redirect directly to GitHub App installation
      // GitHub will show organization selector and handle OAuth
      const response = await request({
        method: "GET",
        url: app_installation_url_github_path(),
        accept: "json",
      });

      if (!response.ok) {
        throw new Error("Failed to get GitHub App installation URL");
      }

      const data = z.object({ url: z.string() }).parse(await response.json());

      // Full page redirect to GitHub
      window.location.href = data.url;
    } catch (error) {
      setOrgsError(error instanceof Error ? error.message : "Failed to connect GitHub");
      setIsLoadingOrgs(false);
    }
  }, []);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "DELETE",
        url: disconnect_company_github_path(company.id),
        accept: "json",
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to disconnect GitHub organization");
      }

      const data = z
        .object({
          success: z.boolean(),
          app_uninstalled: z.boolean().optional(),
        })
        .parse(await response.json());

      return data;
    },
    onSuccess: () => {
      setIsDisconnectModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const handleDisconnectModalOpenChange = (open: boolean) => {
    if (!open) {
      disconnectMutation.reset();
    }
    setIsDisconnectModalOpen(open);
  };

  const handleOrgSelectorOpenChange = (open: boolean) => {
    if (open) {
      // Reset mutation state when opening the modal
      connectMutation.reset();
    } else {
      setSelectedOrg(null);
      setOrgsError(null);
    }
    setIsOrgSelectorOpen(open);
  };

  const handleOrgSelect = (org: GitHubOrg) => {
    setSelectedOrg(org);
  };

  const handleConfirmOrg = async () => {
    if (selectedOrg) {
      try {
        // Redirect to GitHub with selected org pre-selected
        const response = await request({
          method: "GET",
          url: app_installation_url_github_path({
            org_id: selectedOrg.id.toString(),
            org_name: selectedOrg.login,
          }),
          accept: "json",
        });

        if (!response.ok) {
          throw new Error("Failed to get GitHub App installation URL");
        }

        const data = z.object({ url: z.string() }).parse(await response.json());
        window.location.href = data.url;
      } catch (error) {
        setOrgsError(error instanceof Error ? error.message : "Failed to connect GitHub");
      }
    }
  };

  const handleReauthenticate = async () => {
    setIsReauthenticating(true);
    try {
      await triggerOAuthPopup();
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);
      setSelectedOrg(null);
    } catch (error) {
      setOrgsError(error instanceof Error ? error.message : "Failed to re-authenticate");
    } finally {
      setIsReauthenticating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image src={githubMark} alt="GitHub" width={32} height={32} className="dark:invert" />
            <div className="flex flex-col">
              <span className="font-medium">GitHub</span>
              <span className="text-muted-foreground text-sm">
                Automatically verify contractor pull requests and bounty claims.
              </span>
            </div>
          </div>
          {company.githubOrgName ? (
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <span className="size-2 rounded-full bg-green-500" />
                  {company.githubOrgName}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="hover:text-destructive focus:text-destructive"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsDisconnectModalOpen(true);
                  }}
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleConnect()}
              disabled={isLoadingOrgs}
            >
              {isLoadingOrgs ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </CardHeader>
      </Card>

      {orgsError && !isOrgSelectorOpen ? <p className="text-destructive text-sm">{orgsError}</p> : null}

      {/* Organization Selector Modal */}
      <Dialog open={isOrgSelectorOpen} onOpenChange={handleOrgSelectorOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select GitHub organization</DialogTitle>
            <DialogDescription>
              Choose which organization to connect for PR verification and bounty tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {organizations.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm">
                You are not a member of any GitHub organizations.
              </p>
            ) : (
              organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleOrgSelect(org)}
                  className={`hover:bg-accent flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedOrg?.id === org.id ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <Avatar className="size-8">
                    <AvatarImage src={org.avatar_url} alt="" />
                    <AvatarFallback>{org.login.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{org.login}</span>
                </button>
              ))
            )}
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Don't see your organization?{" "}
              <a
                href="https://github.com/settings/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link hover:underline"
              >
                Grant access on GitHub
              </a>
              , then{" "}
              <button
                type="button"
                onClick={() => void handleReauthenticate()}
                disabled={isReauthenticating}
                className="text-link hover:underline disabled:opacity-50"
              >
                {isReauthenticating ? "refreshing..." : "refresh the list"}
              </button>
              .
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOrgSelectorOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirmOrg()} disabled={!selectedOrg}>
              Continue to GitHub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Modal */}
      <AlertDialog open={isDisconnectModalOpen} onOpenChange={handleDisconnectModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect {company.githubOrgName} from Flexile and uninstall the GitHub App from the
              organization. Contractors will no longer be able to verify Pull Request ownership.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationStatusButton
                idleVariant="critical"
                mutation={disconnectMutation}
                onClick={(e) => {
                  e.preventDefault();
                  disconnectMutation.mutate();
                }}
                loadingText="Disconnecting..."
              >
                Disconnect
              </MutationStatusButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
