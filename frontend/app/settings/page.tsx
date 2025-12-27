"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import githubLogo from "@/images/github.svg";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { settings_path, unimpersonate_admin_users_path } from "@/utils/routes";

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <DetailsSection />
      <GitHubConnectionSection />
      <LeaveWorkspaceSection />
    </div>
  );
}

const GitHubConnectionSection = () => {
  const queryClient = useQueryClient();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const { data: githubConnection, isLoading } = trpc.github.getUserConnection.useQuery();

  const connectMutation = useMutation({
    mutationFn: () =>
      // TODO: Implement OAuth flow - this will open a popup window for GitHub OAuth
      // For now, we'll show a message that this feature is coming soon
      Promise.reject(new Error("GitHub integration is coming soon")),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["github", "getUserConnection"] });
    },
  });

  const disconnectMutation = trpc.github.disconnectUser.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["github", "getUserConnection"] });
      setDisconnectDialogOpen(false);
    },
  });

  const isConnected = githubConnection?.connected ?? false;
  const username = githubConnection?.username;
  const avatarUrl = githubConnection?.avatarUrl;

  return (
    <>
      <div className="grid gap-4">
        <h3 className="text mt-4 font-medium">Connected accounts</h3>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
                <Image src={githubLogo} alt="GitHub" width={20} height={20} className="dark:invert" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">GitHub</CardTitle>
                <CardDescription>
                  {isConnected && username
                    ? `Connected as @${username}`
                    : "Connect your GitHub account to verify pull requests"}
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
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={username ?? "User"} width={24} height={24} className="rounded-full" />
                  ) : null}
                  <span className="text-sm font-medium">@{username}</span>
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
      </div>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your GitHub account. Pull request verification will no longer be
              available for your invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationStatusButton
                mutation={disconnectMutation}
                onClick={(e) => {
                  e.preventDefault();
                  disconnectMutation.mutate();
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
    </>
  );
};

const DetailsSection = () => {
  const user = useCurrentUser();
  const form = useForm({
    defaultValues: {
      email: user.email,
      preferredName: user.preferredName || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { email: string; preferredName: string }) => {
      const payload = { settings: { email: values.email, preferred_name: values.preferredName } };

      const response = await request({
        url: settings_path(),
        method: "PATCH",
        accept: "json",
        jsonData: payload,
      });

      if (!response.ok)
        throw new Error(z.object({ error_message: z.string() }).parse(await response.json()).error_message);
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <h2 className="mb-4 text-3xl font-bold">Profile</h2>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" minLength={MIN_EMAIL_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="preferredName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred name (visible to others)</FormLabel>
              <FormControl>
                <Input placeholder="Enter preferred name" maxLength={MAX_PREFERRED_NAME_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {saveMutation.isError ? <p className="text-destructive">{saveMutation.error.message}</p> : null}
        <MutationStatusButton
          className="w-fit"
          idleVariant="primary"
          type="submit"
          mutation={saveMutation}
          loadingText="Saving..."
          successText="Saved!"
        >
          Save
        </MutationStatusButton>
      </form>
    </Form>
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
