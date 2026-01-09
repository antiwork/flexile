"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { GithubIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import Status from "@/components/Status";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

const githubFormSchema = z.object({
  organization: z.string().min(1, "Please enter your GitHub organization name"),
});

type GithubFormValues = z.infer<typeof githubFormSchema>;

export default function GithubIntegrationRow() {
  const company = useCurrentCompany();
  const [githubIntegration, { refetch }] = trpc.github.get.useSuspenseQuery({ companyId: company.id });
  const connectGithub = trpc.github.connect.useMutation();
  const disconnectGithub = trpc.github.disconnect.useMutation({
    onSuccess: () => {
      void refetch();
      setTimeout(() => disconnectGithub.reset(), 2000);
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
        companyId: company.id,
        organization: data.organization,
      });
      void refetch();
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
              <GithubIcon className="size-5" />
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
            <MutationButton
              mutation={disconnectGithub}
              param={{ companyId: company.id }}
              idleVariant="outline"
              loadingText="Disconnecting..."
              successText="Disconnected!"
            >
              Disconnect
            </MutationButton>
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
    </div>
  );
}
