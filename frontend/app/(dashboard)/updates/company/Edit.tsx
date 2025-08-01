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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import RadioButtons from "@/components/RadioButtons";
import ComboBox from "@/components/ComboBox";
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
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Recipient selection state
  const [includeContractors, setIncludeContractors] = useState(false);
  const [contractorStatus, setContractorStatus] = useState<"active" | "all">("active");
  const [minBillingThreshold, setMinBillingThreshold] = useState<number | undefined>();
  const [includeInvestors, setIncludeInvestors] = useState(true);
  const [investorTypes, setInvestorTypes] = useState<string[]>([]);

  // Calculate recipient count based on selections
  const getRecipientCount = () => {
    let count = 1; // Always include at least 1 admin
    if (includeContractors) {
      count += company.contractorCount ?? 0;
    }
    if (includeInvestors) {
      count += company.investorCount ?? 0;
    }
    return count;
  };

  const recipientCount = getRecipientCount();

  const createMutation = trpc.companyUpdates.create.useMutation();
  const updateMutation = trpc.companyUpdates.update.useMutation();
  const publishMutation = trpc.companyUpdates.publish.useMutation();
  const sendTestEmailMutation = trpc.companyUpdates.sendTestEmail.useMutation();
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
      if (!preview && !update?.sentAt) {
        await publishMutation.mutateAsync({
          companyId: company.id,
          id,
          includeContractors,
          contractorStatus,
          minBillingThreshold,
          includeInvestors,
          investorTypes,
        });
      }
      void trpcUtils.companyUpdates.list.invalidate();
      if (preview) {
        setPreviewModalOpen(false);
        await sendTestEmailMutation.mutateAsync({
          companyId: company.id,
          id,
          includeContractors,
          contractorStatus,
          minBillingThreshold,
          includeInvestors,
          investorTypes,
        });
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreviewModalOpen(true)}
                  >
                    <FileScan className="size-4" />
                    Preview
                  </Button>
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
            <div className="space-y-4 rounded-lg border p-4">
              <div className="text-sm font-medium">Recipients ({recipientCount.toLocaleString()})</div>
              
              <div className="space-y-3">
                <div className="text-xs text-gray-500 uppercase">Always included:</div>
                <div className="flex items-center gap-2 pl-4">
                  <UsersIcon className="size-4" />
                  <span className="text-sm">Company administrators</span>
                </div>
              </div>

              <div className="space-y-3">
                <FormItem className="flex items-center space-x-2">
                  <Checkbox
                    id="includeContractors"
                    checked={includeContractors}
                    onCheckedChange={(checked) => setIncludeContractors(checked as boolean)}
                  />
                  <FormLabel htmlFor="includeContractors" className="text-sm font-normal cursor-pointer">
                    Include contractors
                  </FormLabel>
                </FormItem>
                
                {includeContractors && (
                  <div className="pl-6 space-y-3">
                    <RadioButtons
                      value={contractorStatus}
                      onChange={(value) => setContractorStatus(value)}
                      options={[
                        { value: "active", label: `Active contractors only (${company.contractorCount ?? 0})` },
                        { value: "all", label: `All contractors including alumni` },
                      ]}
                    />
                    
                    <FormItem>
                      <FormLabel className="text-sm">Minimum billing threshold (optional)</FormLabel>
                      <Input
                        type="number"
                        placeholder="e.g. 1000"
                        value={minBillingThreshold || ""}
                        onChange={(e) => setMinBillingThreshold(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-32"
                      />
                      <p className="text-xs text-gray-500">Only include contractors who have billed ≥ this amount</p>
                    </FormItem>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <FormItem className="flex items-center space-x-2">
                  <Checkbox
                    id="includeInvestors"
                    checked={includeInvestors}
                    onCheckedChange={(checked) => setIncludeInvestors(checked as boolean)}
                  />
                  <FormLabel htmlFor="includeInvestors" className="text-sm font-normal cursor-pointer">
                    Include investors ({company.investorCount ?? 0})
                  </FormLabel>
                </FormItem>
              </div>
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
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview update</DialogTitle>
          </DialogHeader>
          <p>A preview email will be sent to your email address.</p>
          <p className="text-sm text-gray-500">The actual update will be sent to {recipientCount.toLocaleString()} recipients based on your selections.</p>
          <DialogFooter>
            <div className="grid auto-cols-fr grid-flow-col items-center gap-3">
              <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
                Cancel
              </Button>
              <MutationButton
                mutation={saveMutation}
                param={{ values: form.getValues(), preview: true }}
                loadingText="Sending preview..."
              >
                Send preview
              </MutationButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Edit;
