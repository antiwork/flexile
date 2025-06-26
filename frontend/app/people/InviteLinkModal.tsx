import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Link</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Share a link so contractors can add their details, set a rate, and sign their own contract.
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">Link</span>

          <div className="flex items-center gap-2">
            <Input readOnly value={invite.invite_link} className="text-muted-foreground ml-0 flex-1 bg-transparent" />
            <Button
              type="button"
              size="small"
              variant={copied ? "success" : "outline"}
              onClick={async () => {
                await navigator.clipboard.writeText(invite.invite_link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Anyone with this link can join your workspace.</span>
            <Button
              variant="link"
              size="small"
              onClick={() => {
                onOpenChange(false);
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
