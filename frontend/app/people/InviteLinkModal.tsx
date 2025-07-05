import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { DocumentTemplateType, trpc } from "@/trpc/client";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import TemplateSelector from "@/app/document_templates/TemplateSelector";
import { MutationStatusButton } from "@/components/MutationButton";
import { Check, Copy } from "lucide-react";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteLinkModal = ({ open, onOpenChange }: InviteLinkModalProps) => {
  const company = useCurrentCompany();
  const [copied, setCopied] = useState(false);
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);

  const form = useForm({
    defaultValues: {
      companyId: company.id,
      contractSignedElsewhere: true,
      documentTemplateId: "",
    },
    resolver: zodResolver(
      z.object({
        companyId: z.string().uuid(),
        contractSignedElsewhere: z.boolean(),
        documentTemplateId: z.string().nullable().optional(),
      }),
    ),
  });

  const documentTemplateId = form.watch("documentTemplateId");
  const contractSignedElsewhere = form.watch("contractSignedElsewhere");

  const queryParams = useMemo(
    () => ({
      companyId: company.id,
      documentTemplateId: !contractSignedElsewhere ? (documentTemplateId ?? null) : null,
    }),
    [company.id, documentTemplateId, contractSignedElsewhere],
  );

  const { data: invite, refetch } = trpc.companyInviteLinks.get.useQuery(queryParams, {
    enabled: !!company.id,
  });

  const trpcUtils = trpc.useUtils();
  const resetInviteLinkMutation = trpc.companyInviteLinks.reset.useMutation({
    onSuccess: async () => {
      await trpcUtils.companyInviteLinks.get.invalidate(queryParams);
      refetch();
      setShowResetLinkModal(false);
    },
  });
  const resetInviteLink = () => {
    resetInviteLinkMutation.mutateAsync(queryParams);
  };

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="md:mb-80">
          <DialogHeader>
            <DialogTitle>Invite link</DialogTitle>
            <DialogDescription>
              Share a link so contractors can add their details, set a rate, and sign their own contract.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              id="contractor-invite-link"
              className="text-foreground text-sm"
              readOnly
              value={invite?.invite_link}
              aria-label="Link"
            />
            <Form {...form}>
              <FormField
                control={form.control}
                name="contractSignedElsewhere"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label={<span className="text-sm">Already signed contract elsewhere.</span>}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {!form.watch("contractSignedElsewhere") && (
                <FormField
                  control={form.control}
                  name="documentTemplateId"
                  render={({ field }) => <TemplateSelector type={DocumentTemplateType.ConsultingContract} {...field} />}
                />
              )}
            </Form>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setShowResetLinkModal(true);
              }}
            >
              Reset link
            </Button>
            <Button
              type="button"
              size="default"
              variant={copied ? "success" : "default"}
              disabled={!invite?.invite_link}
              onClick={async () => {
                await navigator.clipboard.writeText(invite?.invite_link || "");
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
            >
              {copied ? (
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4" />
                  <span>Copied!</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy link</span>
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showResetLinkModal} onOpenChange={setShowResetLinkModal}>
        <DialogContent className="md:mb-80">
          <DialogHeader>
            <DialogTitle>Reset invite link?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Resetting the link will deactivate the current invite. If you have already shared it, others may not be
              able to join.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResetLinkModal(false)}>
                Cancel
              </Button>
              <MutationStatusButton mutation={resetInviteLinkMutation} type="button" onClick={resetInviteLink}>
                Reset link
              </MutationStatusButton>
            </div>
            {resetInviteLinkMutation.isError ? (
              <div className="text-red text-sm">{resetInviteLinkMutation.error.message}</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InviteLinkModal;
