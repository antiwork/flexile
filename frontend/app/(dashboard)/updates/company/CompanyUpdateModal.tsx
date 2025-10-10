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
import { request } from "@/utils/request";
import { company_company_update_path, company_company_updates_path } from "@/utils/routes";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
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
    },
  });

  useEffect(() => {
    if (update) {
      form.reset({
        title: update.title,
        body: update.body,
      });
    } else if (!updateId) {
      form.reset({
        title: "",
        body: "",
      });
    }
  }, [update, updateId, form]);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [viewPreview, setViewPreview] = useState(false);
  const [previewUpdateId, setPreviewUpdateId] = useState<string | null>(null);

  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const saveMutation = useMutation({
    mutationFn: async ({ values, preview }: { values: z.infer<typeof formSchema>; preview: boolean }) => {
      const formData = new FormData();
      formData.append("company_update[title]", values.title);
      formData.append("company_update[body]", values.body);
      if (!preview && !update?.sentAt) {
        formData.append("publish", "true");
      }

      const existingId = update?.id || previewUpdateId;
      const method = existingId ? "PATCH" : "POST";
      const url = existingId
        ? company_company_update_path(company.externalId, existingId)
        : company_company_updates_path(company.externalId);

      const response = await request({
        method,
        url,
        formData,
        accept: "json",
        assertOk: true,
      });

      const companyUpdateResponseSchema = z.object({ company_update: z.object({ id: z.string() }) });
      const updateId = existingId || companyUpdateResponseSchema.parse(await response.json()).company_update.id;
      void trpcUtils.companyUpdates.list.invalidate();
      await trpcUtils.companyUpdates.get.invalidate({ companyId: company.id, id: updateId });
      if (preview) {
        setPreviewUpdateId(updateId);
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
        <DialogContent className="flex flex-col sm:max-w-4xl" onPrimaryAction={() => submit()}>
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

          <div className="flex w-full flex-col-reverse justify-end gap-3 md:flex-row">
            {update?.sentAt ? (
              <Button className="w-full md:w-fit" variant="primary" onClick={() => void submit()}>
                Update
              </Button>
            ) : (
              <>
                <MutationStatusButton
                  type="button"
                  mutation={saveMutation}
                  idleVariant="outline"
                  loadingText="Saving..."
                  className="w-full md:w-fit"
                  onClick={() =>
                    void form.handleSubmit((values) => saveMutation.mutateAsync({ values, preview: true }))()
                  }
                >
                  Preview
                </MutationStatusButton>
                <Button className="w-full md:w-fit" variant="primary" onClick={() => void submit()}>
                  Publish
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent onPrimaryAction={() => saveMutation.mutate({ values: form.getValues(), preview: false })}>
          <DialogHeader>
            <DialogTitle>Publish update?</DialogTitle>
          </DialogHeader>
          {update?.sentAt ? (
            <p>Your update will be visible in Flexile. No new emails will be sent.</p>
          ) : (
            <p>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</p>
          )}
          <DialogFooter>
            <div className="md:grid-flow-col-reverse flex flex-col-reverse items-center gap-3 md:grid md:auto-cols-fr">
              <Button variant="outline" className="w-full md:w-fit" onClick={() => setPublishModalOpen(false)}>
                No, cancel
              </Button>
              <MutationButton
                mutation={saveMutation}
                param={{ values: form.getValues(), preview: false }}
                loadingText="Sending..."
                className="w-full md:w-fit"
                idleVariant="primary"
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
