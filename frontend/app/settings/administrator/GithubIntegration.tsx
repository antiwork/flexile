"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GithubIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import Status from "@/components/Status";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { company_administrator_integrations_github_path } from "@/utils/routes";

const githubFormSchema = z.object({
  organization: z.string().min(1, "Please enter your GitHub organization name"),
});

type GithubFormValues = z.infer<typeof githubFormSchema>;

export default function GithubIntegrationRow() {
  const company = useCurrentCompany();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const { data: githubIntegration, refetch } = useQuery({
    queryKey: ["githubIntegration", company.id],
    queryFn: async () => {
      const res = await fetch(
        company_administrator_integrations_github_path({ company_id: company.id, format: "json" }),
      );
      if (res.ok) {
        return res.json();
      }
      return null;
    },
  });

  const connectGithub = useMutation({
    mutationFn: async (data: { organization: string }) => {
      const res = await fetch(
        company_administrator_integrations_github_path({ company_id: company.id, format: "json" }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error("Failed to connect");
      return res.json();
    },
    onSuccess: () => {
      void refetch();
    },
  });

  const disconnectGithub = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        company_administrator_integrations_github_path({ company_id: company.id, format: "json" }),
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => {
      void refetch();
      setShowDisconnectDialog(false);
    },
  });

  const form = useForm<GithubFormValues>({
    resolver: zodResolver(githubFormSchema),
    defaultValues: {
      organization: githubIntegration?.organization ?? "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: GithubFormValues) => {
      await connectGithub.mutateAsync({
        organization: data.organization,
      });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <div>
      <div className="flex justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="flex items-center pb-1 text-base font-bold">
              <GithubIcon className="size-6" />
              &ensp;GitHub
            </h2>
            {githubIntegration?.status === "active" ? <Status variant="success">Connected</Status> : null}
          </div>
          <p className="text-muted-foreground text-base">
            Connect your GitHub organization to verify pull requests in invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          {githubIntegration?.status === "active" ? (
            <Button variant="outline" onClick={() => setShowDisconnectDialog(true)}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </div>

      {!githubIntegration || githubIntegration.status !== "active" ? (
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="mt-4 flex max-w-md items-end gap-4">
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem className="grow">
                  <FormLabel>GitHub Organization</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. acme-corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <MutationStatusButton
              mutation={saveMutation}
              type="submit"
              loadingText="Connecting..."
              successText="Connected!"
            >
              Connect
            </MutationStatusButton>
          </form>
        </Form>
      ) : (
        <div className="text-muted-foreground mt-2 text-sm">
          Connected to organization: <strong>{githubIntegration.organization}</strong>
        </div>
      )}

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the GitHub integration for your organization. Contractors will no longer be able to
              verify their pull requests in invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <MutationButton
                mutation={disconnectGithub}
                idleVariant="destructive"
                loadingText="Disconnecting..."
                successText="Disconnected!"
              >
                Disconnect
              </MutationButton>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
