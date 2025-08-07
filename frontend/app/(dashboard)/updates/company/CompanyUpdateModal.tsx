"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ViewUpdateDialog from "@/app/(dashboard)/updates/company/ViewUpdateDialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { pluralize } from "@/utils/pluralize";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
  videoUrl: z.string().nullable(),
});

interface CompanyUpdateModalProps {
  open: boolean;
  onClose: () => void;
  updateId?: string;
}

const CompanyUpdateModal = ({ open, onClose, updateId }: CompanyUpdateModalProps) => {
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();

  const { data: update, isLoading } = trpc.companyUpdates.get.useQuery(
    { companyId: company.id, id: updateId ?? "" },
    { enabled: !!updateId && open },
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: update?.title ?? "",
      body: update?.body ?? "",
      videoUrl: update?.videoUrl ?? "",
    },
  });

  useEffect(() => {
    if (update) {
      form.reset({
        title: update.title,
        body: update.body,
        videoUrl: update.videoUrl ?? "",
      });
    } else if (!updateId) {
      form.reset({
        title: "",
        body: "",
        videoUrl: "",
      });
    }
  }, [update, updateId, form]);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [viewPreview, setViewPreview] = useState(false);
  const [previewUpdateId, setPreviewUpdateId] = useState<string | null>(null);

  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const createMutation = trpc.companyUpdates.create.useMutation();
  const updateMutation = trpc.companyUpdates.update.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();

  const saveMutation = useMutation({
    mutationFn: async ({ values, preview }: { values: z.infer<typeof formSchema>; preview: boolean }) => {
      const data = {
        companyId: company.id,
        ...values,
        videoUrl: values.videoUrl || null,
      };
      let id;
      if (update) {
        id = update.id;
        await updateMutation.mutateAsync({ ...data, id });
      } else if (previewUpdateId) {
        id = previewUpdateId;
        await updateMutation.mutateAsync({ ...data, id });
      } else {
        id = await createMutation.mutateAsync(data);
      }
      if (!preview && !update?.sentAt) await publishMutation.mutateAsync({ companyId: company.id, id });
      void trpcUtils.companyUpdates.list.invalidate();
      await trpcUtils.companyUpdates.get.invalidate({ companyId: company.id, id });
      if (preview) {
        setPreviewUpdateId(id);
        setViewPreview(true);
      } else {
        handleClose();
      }
    },
  });

  const submit = form.handleSubmit(() => setPublishModalOpen(true));

  const handleClose = () => {
    setPublishModalOpen(false);
    setViewPreview(false);
    setPreviewUpdateId(null);
    form.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{update ? "Edit company update" : "New company update"}</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">Loading...</div>
          ) : (
            <Form {...form}>
              <form onSubmit={(e) => void submit(e)} className="space-y-6">
                <div className="space-y-4">
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

                <div className="space-y-4">
                  <Label>Recipients ({recipientCount.toLocaleString()})</Label>
                  <div className="mt-2 space-y-2">
                    {company.investorCount ? (
                      <div className="flex items-center gap-2">
                        <Users className="size-4" />
                        <span>
                          {company.investorCount.toLocaleString()} {pluralize("investor", company.investorCount)}
                        </span>
                      </div>
                    ) : null}
                    {company.contractorCount ? (
                      <div className="flex items-center gap-2">
                        <Users className="size-4" />
                        <span>
                          {company.contractorCount.toLocaleString()} active{" "}
                          {pluralize("contractor", company.contractorCount)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
            </Form>
          )}

          <div className="pt-4">
            <div className="flex justify-end gap-3">
              {update?.sentAt ? (
                <Button onClick={() => void submit()}>Update</Button>
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
                    Preview
                  </MutationStatusButton>
                  <Button onClick={() => void submit()}>Publish</Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
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
              <Button variant="outline" onClick={() => setPublishModalOpen(false)}>
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

      {viewPreview && previewUpdateId ? (
        <ViewUpdateDialog
          updateId={previewUpdateId}
          onOpenChange={() => {
            setViewPreview(false);
          }}
        />
      ) : null}
    </>
  );
};

export default CompanyUpdateModal;
