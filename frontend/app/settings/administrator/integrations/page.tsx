"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentCompany } from "@/global";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";

export default function IntegrationsPage() {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const { data: githubConnection, isLoading } = trpc.github.getCompanyConnection.useQuery({
    companyId: company.id,
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      // TODO: Implement OAuth flow - this will open a popup window for GitHub OAuth
      // For now, we'll show a message that this feature is coming soon
      Promise.reject(new Error("GitHub integration is coming soon")),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["github", "getCompanyConnection"] });
    },
  });

  const disconnectMutation = trpc.github.disconnectCompany.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["github", "getCompanyConnection"] });
      setDisconnectDialogOpen(false);
    },
  });

  const isConnected = githubConnection?.connected ?? false;
  const organizationName = githubConnection?.organizationName;
  const organizationAvatarUrl = githubConnection?.organizationAvatarUrl;

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Integrations</h2>
        <p className="text-muted-foreground text-base">Connect external services to enhance your workflow.</p>
      </hgroup>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
              <Image src={githubLogo} alt="GitHub" width={20} height={20} className="dark:invert" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">GitHub</CardTitle>
              <CardDescription>
                {isConnected && organizationName
                  ? `Connected to ${organizationName}`
                  : "Connect your GitHub organization to verify pull requests"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {organizationAvatarUrl ? (
                  <Image
                    src={organizationAvatarUrl}
                    alt={organizationName ?? "Organization"}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : null}
                <span className="text-sm font-medium">{organizationName}</span>
              </div>
              <Button variant="outline" onClick={() => setDisconnectDialogOpen(true)}>
                Disconnect
              </Button>
            </div>
          ) : (
            <MutationStatusButton
              mutation={connectMutation}
              onClick={() => connectMutation.mutate()}
              idleVariant="outline"
              loadingText="Connecting..."
              successText="Connected!"
            >
              Connect GitHub
            </MutationStatusButton>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your GitHub organization. Pull request verification will no longer be
              available for invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationStatusButton
                mutation={disconnectMutation}
                onClick={(e) => {
                  e.preventDefault();
                  disconnectMutation.mutate({ companyId: company.id });
                }}
                idleVariant="critical"
                loadingText="Disconnecting..."
                successText="Disconnected!"
              >
                Disconnect
              </MutationStatusButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
