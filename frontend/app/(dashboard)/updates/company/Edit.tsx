"use client";

import { EnvelopeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { FileScan } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ViewUpdateDialog from "@/app/(dashboard)/updates/company/ViewUpdateDialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
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
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { pluralize } from "@/utils/pluralize";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
  videoUrl: z.string().nullable(),
});

type CompanyUpdate = RouterOutput["companyUpdates"]["get"];
const Edit = ({ update }: { update?: CompanyUpdate }) => {
  const { id } = useParams<{ id?: string }>();
  const pathname = usePathname();
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
  const navigatedFromNewPreview = sessionStorage.getItem("navigated-from-new-preview");
  const [viewPreview, setViewPreview] = useState(!!navigatedFromNewPreview);

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
        if (pathname === "/updates/company/new") {
          sessionStorage.setItem("navigated-from-new-preview", "yes");
          router.replace(`/updates/company/${id}/edit`);
        } else {
          await trpcUtils.companyUpdates.get.invalidate({ companyId: company.id, id });
          setViewPreview(true);
        }
      } else {
        router.push(`/updates/company`);
      }
    },
  });

  const submit = form.handleSubmit(() => setModalOpen(true));

  useEffect(() => {
    if (navigatedFromNewPreview) {
      sessionStorage.removeItem("navigated-from-new-preview");
    }
  }, []);

  return (
    <>
      <Form {...form}>
        <form onSubmit={(e) => void submit(e)}>
          <DashboardHeader
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
                    onClick={() =>
                      void form.handleSubmit((values) => saveMutation.mutateAsync({ values, preview: true }))()
                    }
                  >
                    <FileScan className="size-4" />
                    Preview
                  </MutationStatusButton>
                  <Button type="submit">
                    <EnvelopeIcon className="size-4" />
                    Publish
                  </Button>
                </>
              )
            }
          />
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
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
          <AlertDialog open={modalOpen} onOpenChange={setModalOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish update?</AlertDialogTitle>
                <AlertDialogDescription>
                  {update?.sentAt ? (
                    <>Your update will be visible in Flexile. No new emails will be sent.</>
                  ) : (
                    <>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, cancel</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <MutationButton
                    mutation={saveMutation}
                    param={{ values: form.getValues(), preview: false }}
                    loadingText="Sending..."
                  >
                    Yes, {update?.sentAt ? "update" : "publish"}
                  </MutationButton>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </Form>
      {viewPreview && id ? (
        <ViewUpdateDialog
          updateId={id}
          onOpenChange={() => {
            setViewPreview(false);
          }}
        />
      ) : null}
    </>
  );
};

export default Edit;
