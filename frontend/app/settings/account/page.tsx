"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import githubLogo from "@/images/github.svg";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import {
  disconnect_github_connection_path,
  start_github_connection_path,
  unimpersonate_admin_users_path,
} from "@/utils/routes";

export default function AccountPage() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <h1 className="mb-1 text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground text-base">Manage your linked accounts and workspace access.</p>
      </hgroup>
      <IntegrationsSection />
      <LeaveWorkspaceSection />
    </div>
  );
}

const IntegrationsSection = () => {
  const user = useCurrentUser();
  const { data: githubUsername, isLoading: githubLoading } = trpc.github.getUserConnection.useQuery(undefined, {
    enabled: !!user.roles.worker,
  });
  const utils = trpc.useUtils();
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (searchParams.get("github") === "success" && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("GitHub account successfully linked.");
      router.replace("/settings/account");
    }
  }, [searchParams, router]);

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    try {
      const response = await request({
        method: "POST",
        accept: "json",
        url: start_github_connection_path(),
        assertOk: true,
      });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = (await response.json()) as { url: string },
        { url } = data;
      window.location.href = url;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    await request({
      method: "DELETE",
      accept: "json",
      url: disconnect_github_connection_path(),
      assertOk: true,
    });
    await utils.github.getUserConnection.invalidate();
    toast.info("GitHub account disconnected.");
  };

  if (!user.roles.worker) return null;

  return (
    <div className="grid gap-4">
      <h2 className="font-bold">Integrations</h2>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="border-muted size-8 rounded-md border-2 bg-white">
              <AvatarImage src={githubLogo.src} alt="Github logo" />
              <AvatarFallback className="rounded-none">G</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold">GitHub</span>
              <span className="text-muted-foreground text-sm">
                {githubUsername
                  ? "Your account is linked for verifying pull requests and bounties."
                  : "Link your GitHub account to verify ownership of your work."}
              </span>
            </div>
          </div>

          {githubLoading ? (
            <Loader2 className="text-muted-foreground animate-spin" />
          ) : githubUsername ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{githubUsername}</span>
                  <ChevronDown className="text-muted-foreground size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-0" role="menu" align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full justify-start rounded-none">
                      Disconnect account
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader className="mb-4">
                      <AlertDialogTitle>Disconnect GitHub account?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground mt-2 text-base">
                        Disconnecting stops us from verifying your GitHub work.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <Button variant="outline">Cancel</Button>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button variant="critical" onClick={() => void handleDisconnectGitHub()}>
                          Disconnect
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              variant="outline"
              className="w-full text-base sm:w-auto"
              disabled={isConnecting}
              onClick={() => void handleConnectGitHub()}
            >
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          )}
        </CardHeader>
      </Card>
    </div>
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
        throw new Error(errorData.error_message || errorData.error || "Failed to leave workspace");
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
        <h3 className="text mt-4 font-medium">Workspace access</h3>
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
