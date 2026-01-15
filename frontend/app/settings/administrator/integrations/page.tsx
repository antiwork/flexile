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
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany } from "@/global";
import githubMark from "@/images/github-mark.svg";
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
  const queryClient = useQueryClient();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
                  <span className="size-2 rounded-full bg-green-700" />
                  {company.githubOrgName}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="hover:text-destructive focus:text-destructive justify-center"
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
              disabled={isLoadingConnect}
            >
              {isLoadingConnect ? (
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

      {connectError ? <p className="text-destructive text-sm">{connectError}</p> : null}

      <AlertDialog open={isDisconnectModalOpen} onOpenChange={handleDisconnectModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent contractors from verifying Pull Request ownership and disable automatic bounty checks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
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
