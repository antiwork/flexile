"use client";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";

export default function IntegrationsPage() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [organizationInput, setOrganizationInput] = useState("");

  const { data: githubConnection, isLoading } = trpc.github.getCompanyConnection.useQuery({
    companyId: company.id,
  });

  const connectMutation = trpc.github.connectCompany.useMutation({
    onSuccess: () => {
      void utils.github.getCompanyConnection.invalidate();
      setConnectDialogOpen(false);
      setOrganizationInput("");
    },
  });

  const disconnectMutation = trpc.github.disconnectCompany.useMutation({
    onSuccess: () => {
      void utils.github.getCompanyConnection.invalidate();
      setDisconnectDialogOpen(false);
    },
  });

  const isConnected = githubConnection?.connected ?? false;
  const organizationName = githubConnection?.organizationName;
  const organizationAvatarUrl = githubConnection?.organizationAvatarUrl;

  const handleConnect = () => {
    if (organizationInput.trim()) {
      connectMutation.mutate({
        companyId: company.id,
        organizationName: organizationInput.trim(),
      });
    }
  };

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
            <Button variant="outline" onClick={() => setConnectDialogOpen(true)}>
              Connect GitHub
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GitHub organization</DialogTitle>
            <DialogDescription>
              Enter your GitHub organization name to enable pull request verification for invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="organization">Organization name</Label>
              <Input
                id="organization"
                placeholder="e.g., antiwork"
                value={organizationInput}
                onChange={(e) => setOrganizationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConnect();
                  }
                }}
              />
              <p className="text-muted-foreground text-sm">
                This is the organization name from your GitHub URL: github.com/
                <strong>{organizationInput || "organization"}</strong>
              </p>
            </div>
            {connectMutation.error ? <p className="text-destructive text-sm">{connectMutation.error.message}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <MutationStatusButton
              mutation={connectMutation}
              onClick={handleConnect}
              disabled={!organizationInput.trim()}
              loadingText="Connecting..."
              successText="Connected!"
            >
              Connect
            </MutationStatusButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
