"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import githubMark from "@/images/github-mark.svg";
import { request } from "@/utils/request";
import { connect_company_github_path, disconnect_company_github_path } from "@/utils/routes";

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

const connectFormSchema = z.object({
  githubOrgName: z.string().min(1, "Organization name is required"),
});

const GitHubIntegrationSection = () => {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const form = useForm<z.infer<typeof connectFormSchema>>({
    resolver: zodResolver(connectFormSchema),
    defaultValues: {
      githubOrgName: "",
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (values: z.infer<typeof connectFormSchema>) => {
      const response = await request({
        method: "POST",
        url: connect_company_github_path(company.id),
        accept: "json",
        jsonData: { github_org_name: values.githubOrgName },
      });

      if (!response.ok) {
        const errorData = z.object({ error: z.string().optional() }).safeParse(await response.json());
        throw new Error(errorData.data?.error ?? "Failed to connect GitHub organization");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setIsConnectModalOpen(false);
      form.reset();
    },
  });

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

  const handleConnectSubmit = form.handleSubmit((values) => {
    connectMutation.mutate(values);
  });

  const handleConnectModalOpenChange = (open: boolean) => {
    if (open) {
      connectMutation.reset();
    } else {
      form.reset();
      connectMutation.reset();
    }
    setIsConnectModalOpen(open);
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
                  className="text-destructive focus:text-destructive"
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
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleConnectModalOpenChange(true)}>
              Connect
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Connect Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={handleConnectModalOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GitHub organization</DialogTitle>
            <DialogDescription>
              Enter the name of your GitHub organization to enable automatic verification of pull requests and bounty
              claims.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => void handleConnectSubmit(e)} className="grid gap-4">
              <FormField
                control={form.control}
                name="githubOrgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. antiwork" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleConnectModalOpenChange(false)}>
                  Cancel
                </Button>
                <MutationStatusButton
                  type="submit"
                  mutation={connectMutation}
                  loadingText="Connecting..."
                  successText="Connected!"
                >
                  Connect
                </MutationStatusButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Disconnect Modal */}
      <AlertDialog open={isDisconnectModalOpen} onOpenChange={handleDisconnectModalOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Github organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent contractors from verifying Pull Request ownership and disable automatic bounty checks.
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
