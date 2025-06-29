import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { Label } from "@/components/ui/label";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showResetModal: (open: boolean) => void;
}

const InviteLinkModal = ({ open, onOpenChange, showResetModal }: InviteLinkModalProps) => {
  const company = useCurrentCompany();

  const [invite] = trpc.companyInviteLinks.get.useSuspenseQuery({ companyId: company.id });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:mb-80">
        <DialogHeader>
          <DialogTitle>Invite Link</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Share a link so contractors can add their details, set a rate, and sign their own contract.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invoice-id">Link</Label>
          <div className="ml-auto flex w-full items-center gap-2">
            <Input
              id="contractor-invite-link"
              className="text-foreground text-sm"
              readOnly
              value={invite.invite_link}
            />

            <Button
              type="button"
              size="small"
              variant={copied ? "success" : "outline"}
              onClick={async () => {
                await navigator.clipboard.writeText(invite.invite_link);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Anyone with this link can join your workspace.</span>
            <Button
              variant="link"
              size="small"
              onClick={() => {
                showResetModal(true);
              }}
            >
              Reset link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteLinkModal;
