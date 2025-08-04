"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { Card, CardAction, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany, useCurrentUser } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { request } from "@/utils/request";
import { settings_path } from "@/utils/routes";

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <DetailsSection />
      <LeaveWorkspaceSection />
    </div>
  );
}

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
      const response = await request({
        url: settings_path(),
        method: "PATCH",
        accept: "json",
        jsonData: { settings: { email: values.email, preferred_name: values.preferredName } },
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
        {saveMutation.isError ? <p className="text-red-500">{saveMutation.error.message}</p> : null}
        <MutationStatusButton
          className="w-fit"
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
  const company = useCurrentCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setTimeout(() => {
        setIsModalOpen(false);
        router.push("/dashboard");
      }, 1000);
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
  if (!user.roles.worker && !user.roles.investor && !user.roles.lawyer) {
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
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={company.logo_url ?? defaultLogo.src} alt="Company logo" />
                <AvatarFallback>{company.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{company.name}</span>
            </div>
            <CardAction>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsModalOpen(true)}
              >
                Leave workspace
              </Button>
            </CardAction>
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
