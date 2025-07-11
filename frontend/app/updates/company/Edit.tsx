"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { EnvelopeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";

import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";

import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";

import { pluralize } from "@/utils/pluralize";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
  videoUrl: z.string().nullable(),
});
type CompanyUpdate = RouterOutput["companyUpdates"]["get"];
const Edit = ({ update }: { update?: CompanyUpdate }) => {
  const { id } = useParams<{ id?: string }>();
  const company = useCurrentCompany();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: update?.title ?? "",
      body: update?.body ?? "",
      videoUrl: update?.videoUrl ?? "",
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const createMutation = trpc.companyUpdates.create.useMutation();
  const updateMutation = trpc.companyUpdates.update.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();
  const saveMutation = useMutation({
    mutationFn: async ({ values, preview }: { values: z.infer<typeof formSchema>; preview: boolean }) => {
      const data = {
        companyId: company.id,
        ...values,
      };
      let id;
      if (update) {
        id = update.id;
        await updateMutation.mutateAsync({ ...data, id });
      } else {
        id = await createMutation.mutateAsync(data);
      }
      if (!preview && !update?.sentAt) await publishMutation.mutateAsync({ companyId: company.id, id });
      void trpcUtils.companyUpdates.list.invalidate();
      if (preview) {
        router.replace(`/updates/company/${id}/edit`);
        window.open(`/updates/company/${id}`, "_blank");
      } else {
        router.push(`/updates/company/${id}`);
      }
    },
  });

  const submit = form.handleSubmit(async () => {
    setModalOpen(true);
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void submit(e)}>
        <MainLayout
          title={id ? "Edit company update" : "New company update"}
          headerActions={
            update?.sentAt ? (
              <Button type="submit">
                <EnvelopeIcon className="size-4" />
                Update
              </Button>
            ) : (
              <>
                <MutationStatusButton
                  type="button"
                  mutation={saveMutation}
                  idleVariant="outline"
                  loadingText="Saving..."
                  onClick={() => form.handleSubmit((values) => saveMutation.mutateAsync({ values, preview: true }))()}
                >
                  <ArrowTopRightOnSquareIcon className="size-4" />
                  Preview
                </MutationStatusButton>
                <Button type="submit">
                  <EnvelopeIcon className="size-4" />
                  Publish
                </Button>
              </>
            )
          }
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Update</FormLabel>
                    <FormControl>
                      <RichTextEditor {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video URL (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="mb-1 text-xs text-gray-500 uppercase">Recipients ({recipientCount.toLocaleString()})</div>
              {company.investorCount ? (
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  <span>
                    {company.investorCount.toLocaleString()} {pluralize("investor", company.investorCount)}
                  </span>
                </div>
              ) : null}
              {company.contractorCount ? (
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  <span>
                    {company.contractorCount.toLocaleString()} active {pluralize("contractor", company.contractorCount)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish update?</DialogTitle>
              </DialogHeader>
              {update?.sentAt ? (
                <p>Your update will be visible in Flexile. No new emails will be sent.</p>
              ) : (
                <p>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</p>
              )}
              <DialogFooter>
                <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
                  <Button variant="outline" onClick={() => setModalOpen(false)}>
                    No, cancel
                  </Button>
                  <MutationButton
                    mutation={saveMutation}
                    param={{ values: form.getValues(), preview: false }}
                    loadingText="Sending..."
                  >
                    Yes, {update?.sentAt ? "update" : "publish"}
                  </MutationButton>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </MainLayout>
      </form>
    </Form>
  );
};

export default Edit;
