"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { request } from "@/utils/request";
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
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { trpc } from "@/trpc/client";

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

  const saveMutation = trpc.users.update.useMutation({
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <h2 className="mb-4 text-xl font-medium">Profile</h2>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: contractorStatus } = useQuery({
    queryKey: ['contractorStatus', company.id],
    queryFn: async () => {
      const response = await request({
        method: 'GET',
        accept: 'json',
        url: `/internal/companies/${company.id}/contractor_status`,
      });
      return response.json();
    },
  });

  const leaveCompanyMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: 'DELETE',
        accept: 'json',
        url: `/internal/companies/${company.id}/leave`,
        assertOk: true,
      });
      
      return response.json();
    },
    onSuccess: () => {
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

  // Only apply contract restrictions to workers/contractors
  if (user.roles.worker && (
    contractorStatus?.contract_signed_elsewhere ||
    contractorStatus?.has_active_contract
  )) {
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
      <Separator />
      <div className="grid gap-4">
        <h2 className="text-xl font-medium">Workspace access</h2>
        <Card>
          <CardHeader>
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
              You will lose access to all data and documents in {company.name}. Are you sure you want to continue?
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
