"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import githubMark from "@/images/github-mark.svg";
import { request } from "@/utils/request";
import { disconnect_github_path, oauth_url_github_path, unimpersonate_admin_users_path } from "@/utils/routes";

export default function AccountPage() {
  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-3xl font-bold">Account</h2>
        <p className="text-muted-foreground mt-1">Manage your linked accounts and workspace access.</p>
      </div>
      <GitHubIntegrationSection />
      <LeaveWorkspaceSection />
    </div>
  );
}

const GitHubIntegrationSection = () => {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "DELETE",
        url: disconnect_github_path(),
        accept: "json",
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to disconnect GitHub");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setIsDisconnectModalOpen(false);
    },
  });

  const handleConnect = useCallback(async () => {
    // Get the OAuth URL from the backend
    const response = await request({
      method: "GET",
      url: oauth_url_github_path(),
      accept: "json",
    });

    if (!response.ok) {
      return;
    }

    const data = z.object({ url: z.string() }).parse(await response.json());

    // Open popup for OAuth
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    // Listen for OAuth completion
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
      }
    };

    window.addEventListener("message", handleMessage);

    // Poll for popup close (in case user closes it manually)
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  }, [queryClient]);

  return (
    <>
      <div className="grid gap-4">
        <h3 className="mt-4 font-medium">Integrations</h3>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Image src={githubMark} alt="GitHub" width={32} height={32} className="dark:invert" />
              <div className="flex flex-col">
                <span className="font-medium">GitHub</span>
                <span className="text-muted-foreground text-sm">
                  {user.githubUsername
                    ? "Your account is linked for verifying pull requests and bounties."
                    : "Link your GitHub account to verify ownership of your work."}
                </span>
              </div>
            </div>
            {user.githubUsername ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 sm:w-auto">
                    <span className="size-2 rounded-full bg-green-500" />
                    {user.githubUsername}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setIsDisconnectModalOpen(true)}
                  >
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => void handleConnect()}>
                Connect
              </Button>
            )}
          </CardHeader>
        </Card>
      </div>

      <AlertDialog open={isDisconnectModalOpen} onOpenChange={setIsDisconnectModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Github account?</AlertDialogTitle>
            <AlertDialogDescription>Disconnecting stops us from verifying your GitHub work.</AlertDialogDescription>
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

const LeaveWorkspaceSection = () => {
  const user = useCurrentUser();
  const { logout } = useUserStore();
  const company = useCurrentCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unimpersonateMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "DELETE",
        url: unimpersonate_admin_users_path(),
        accept: "json",
        assertOk: true,
      });
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const leaveCompanyMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "DELETE",
        accept: "json",
        url: `/internal/companies/${company.id}/leave`,
      });

      if (!response.ok) {
        const errorSchema = z.object({
          error_message: z.string().optional(),
          error: z.string().optional(),
        });
        const errorData = errorSchema.parse(await response.json().catch(() => ({})));
        throw new Error(errorData.error_message ?? errorData.error ?? "Failed to leave workspace");
      }

      const data = z.object({ success: z.boolean() }).parse(await response.json());
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });

      if (user.companies.length > 1) {
        router.push("/dashboard");
      } else {
        if (user.isImpersonating) await unimpersonateMutation.mutateAsync();
        await signOut({ redirect: false }).then(logout);
        router.push("/login");
      }
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  // Don't show leave option if user is administrator
  if (user.roles.administrator) {
    return null;
  }

  // Don't show leave option if user has no leavable roles
  if (!user.roles.worker && !user.roles.lawyer) {
    return null;
  }

  const handleLeaveCompany = () => {
    setErrorMessage(null);
    leaveCompanyMutation.mutate();
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setErrorMessage(null);
      leaveCompanyMutation.reset();
    }
    setIsModalOpen(open);
  };

  return (
    <>
      <div className="grid gap-4">
        <h3 className="mt-4 font-medium">Workspace access</h3>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={company.logo_url ?? defaultLogo.src} alt="Company logo" />
                <AvatarFallback>{company.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{company.name}</span>
            </div>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setIsModalOpen(true)}>
              Leave workspace
            </Button>
          </CardHeader>
        </Card>
      </div>

      <AlertDialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to all invoices, documents, and other data in {company.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleModalOpenChange(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationStatusButton
                idleVariant="critical"
                mutation={leaveCompanyMutation}
                onClick={(e) => {
                  e.preventDefault();
                  handleLeaveCompany();
                }}
                loadingText="Leaving..."
                successText="Success!"
              >
                Leave
              </MutationStatusButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
