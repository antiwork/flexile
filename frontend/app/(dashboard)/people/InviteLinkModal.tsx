import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import TemplateSelector from "@/app/(dashboard)/document_templates/TemplateSelector";
import CopyButton from "@/components/CopyButton";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { DocumentTemplateType, trpc } from "@/trpc/client";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteLinkModal = ({ open, onOpenChange }: InviteLinkModalProps) => {
  const company = useCurrentCompany();
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);

  const form = useForm({
    defaultValues: {
      contractSignedElsewhere: true,
      documentTemplateId: "",
    },
    resolver: zodResolver(
      z.object({
        contractSignedElsewhere: z.boolean(),
        documentTemplateId: z.string().nullable().optional(),
      }),
    ),
  });

  const documentTemplateId = form.watch("documentTemplateId");
  const contractSignedElsewhere = form.watch("contractSignedElsewhere");

  const queryParams = {
    companyId: company.id,
    documentTemplateId: !contractSignedElsewhere ? (documentTemplateId ?? null) : null,
  };

  const { data: invite, refetch } = trpc.companyInviteLinks.get.useQuery(queryParams, {
    enabled: !!company.id,
  });

  const resetInviteLinkMutation = trpc.companyInviteLinks.reset.useMutation({
    onSuccess: async () => {
      await refetch();
      setShowResetLinkModal(false);
    },
  });
  const resetInviteLink = () => {
    void resetInviteLinkMutation.mutateAsync(queryParams);
  };

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
                        label={<span className="text-sm">Already signed contract elsewhere</span>}
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
            <CopyButton aria-label="Copy" copyText={invite?.invite_link || ""}>
              <Copy className="size-4" />
              <span>Copy</span>
            </CopyButton>
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InviteLinkModal;
