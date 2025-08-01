"use client";

import { EnvelopeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { FileScan } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ViewUpdateDialog from "@/app/(dashboard)/updates/company/ViewUpdateDialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { pluralize } from "@/utils/pluralize";

const formSchema = z.object({
  title: z.string().trim().min(1, "This field is required."),
  body: z.string().regex(/>\w/u, "This field is required."),
  videoUrl: z.string().nullable(),
});

interface NewUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewUpdateModal({ open, onOpenChange }: NewUpdateModalProps) {
  const company = useCurrentCompany();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [viewPreview, setViewPreview] = useState(false);
  const [createdUpdateId, setCreatedUpdateId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      body: "",
      videoUrl: "",
    },
  });

  const recipientCount = (company.contractorCount ?? 0) + (company.investorCount ?? 0);

  const createMutation = trpc.companyUpdates.create.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();

  const saveMutation = useMutation({
    mutationFn: async ({ values, preview }: { values: z.infer<typeof formSchema>; preview: boolean }) => {
      const data = {
        companyId: company.id,
        ...values,
      };
      const id = await createMutation.mutateAsync(data);
      setCreatedUpdateId(id);

      if (!preview) {
        await publishMutation.mutateAsync({ companyId: company.id, id });
        void trpcUtils.companyUpdates.list.invalidate();
        onOpenChange(false);
        router.push(`/updates/company`);
        form.reset();
      } else {
        setViewPreview(true);
      }
    },
  });

  const handleSubmit = form.handleSubmit(() => setPublishModalOpen(true));

  const handleClose = () => {
    if (!saveMutation.isPending) {
      onOpenChange(false);
      form.reset();
      setCreatedUpdateId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>New company update</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                <div className="grid gap-4">
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

                  <div className="bg-muted/30 rounded-lg border p-4">
                    <div className="mb-2 text-xs text-gray-500 uppercase">
                      Recipients ({recipientCount.toLocaleString()})
                    </div>
                    <div className="space-y-2">
                      {company.investorCount ? (
                        <div className="flex items-center gap-2 text-sm">
                          <UsersIcon className="size-4" />
                          <span>
                            {company.investorCount.toLocaleString()} {pluralize("investor", company.investorCount)}
                          </span>
                        </div>
                      ) : null}
                      {company.contractorCount ? (
                        <div className="flex items-center gap-2 text-sm">
                          <UsersIcon className="size-4" />
                          <span>
                            {company.contractorCount.toLocaleString()} active{" "}
                            {pluralize("contractor", company.contractorCount)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
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
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish update?</DialogTitle>
          </DialogHeader>
          <p>Your update will be emailed to {recipientCount.toLocaleString()} stakeholders.</p>
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
                Yes, publish
              </MutationButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewPreview && createdUpdateId ? (
        <ViewUpdateDialog
          updateId={createdUpdateId}
          onOpenChange={() => {
            setViewPreview(false);
          }}
        />
      ) : null}
    </>
  );
}
