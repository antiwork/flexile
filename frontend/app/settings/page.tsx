"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import SettingsLayout from "@/app/settings/Layout";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { trpc } from "@/trpc/client";

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <DetailsSection />
      <WorkspaceAccessSection />
    </SettingsLayout>
  );
}

const DetailsSection = () => {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      email: user.email,
      preferredName: user.preferredName || "",
    },
  });

  const saveMutation = trpc.users.update.useMutation({
    onMutate: () => setLoading(true),
    onSettled: () => setLoading(false),
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <div className="mb-8">
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
                  <Input type="email" minLength={MIN_EMAIL_LENGTH} disabled={loading} {...field} />
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
                  <Input
                    placeholder="Enter preferred name"
                    maxLength={MAX_PREFERRED_NAME_LENGTH}
                    disabled={loading}
                    {...field}
                  />
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
            {loading ? "Saving..." : "Save"}
          </MutationStatusButton>
        </form>
      </Form>
    </div>
  );
};

const WorkspaceAccessSection = () => {
  const user = useCurrentUser();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const currentCompany = user.companies.find((company) => company.id === user.currentCompanyId);

  const contractorStatusQuery = trpc.users.getContractorStatus.useQuery(
    { companyId: currentCompany?.id },
    {
      enabled: !!currentCompany?.id && !!user?.id && !!user.currentCompanyId,
      retry: (failureCount, error) => {
        if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "BAD_REQUEST") {
          return false;
        }
        return failureCount < 3;
      },
    },
  );

  const leaveWorkspaceMutation = trpc.users.leaveWorkspace.useMutation({
    onSuccess: (data) => {
      setShowLeaveModal(false);
      void contractorStatusQuery.refetch();
    },
    onError: (error) => {
      return error.message;
    },
  });

  const handleLeaveWorkspace = () => {
    if (!currentCompany?.id) {
      return;
    }

    leaveWorkspaceMutation.mutate({
      companyId: currentCompany.id,
    });
  };

  if (!currentCompany || !user.currentCompanyId) {
    return null;
  }

  // Show loading state while checking contractor status
  if (contractorStatusQuery.isLoading) {
    return (
      <div className="pt-4">
        <h2 className="mb-4 text-xl font-medium">Workspace access</h2>
        <div className="flex items-center justify-center rounded-lg border border-gray-200 p-4">
          <span className="text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  // Handle error states
  if (contractorStatusQuery.error) {
    if (
      contractorStatusQuery.error?.data?.code === "UNAUTHORIZED" ||
      contractorStatusQuery.error?.data?.code === "BAD_REQUEST"
    ) {
      return null;
    }

    return (
      <div className="pt-4">
        <h2 className="mb-4 text-xl font-medium">Workspace access</h2>
        <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4">
          <span className="text-red-600">Error loading contractor status</span>
        </div>
      </div>
    );
  }

  if (!contractorStatusQuery.data?.hasActiveContract) {
    return null;
  }

  return (
    <>
      <div className="pt-4">
        <h2 className="mb-4 text-xl font-medium">Workspace access</h2>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {currentCompany?.logo_url && (
              <div className="relative h-8 w-8">
                <Image
                  src={currentCompany.logo_url || defaultCompanyLogo}
                  alt="Workspace Logo"
                  fill
                  className="rounded"
                />
              </div>
            )}
            <div>
              <span className="font-medium">{currentCompany ? currentCompany.name : "Current Workspace"}</span>
              {contractorStatusQuery.data?.contractorData && (
                <p className="text-sm text-gray-500">
                  Active contractor since{" "}
                  {new Date(contractorStatusQuery.data.contractorData.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="z-50 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowLeaveModal(true)}
            disabled={leaveWorkspaceMutation.isLoading}
          >
            Leave workspace
          </Button>
        </div>
      </div>

      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave this workspace?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This will end your contractor relationship and you'll lose access to all invoices and documents shared in
              this space.
              {contractorStatusQuery.data?.contractorData?.contractSignedElsewhere && (
                <span className="mt-2 block text-red-600">
                  Note: You have a contract signed elsewhere. You cannot leave this workspace until that contract is
                  resolved.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Show error message if mutation failed */}
          {leaveWorkspaceMutation.error && (
            <div className="mt-4 rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{leaveWorkspaceMutation.error.message}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowLeaveModal(false)}
              disabled={leaveWorkspaceMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              className="border-0 bg-red-600 text-white hover:bg-red-700"
              disabled={
                leaveWorkspaceMutation.isLoading || contractorStatusQuery.data?.contractorData?.contractSignedElsewhere
              }
              onClick={handleLeaveWorkspace}
            >
              {leaveWorkspaceMutation.isLoading ? "Leaving..." : "Leave"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
