"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import React, { useState } from "react";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { company_invite_links_path, reset_company_invite_links_path } from "@/utils/routes";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteLinkModal = ({ open, onOpenChange }: InviteLinkModalProps) => {
  const company = useCurrentCompany();
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);

  const { data: invite, refetch } = useQuery({
    queryKey: ["companyInviteLink", company.id],
    queryFn: async () => {
      if (!company.id) return null;
      const url = company_invite_links_path(company.id);
      const response = await request({ url, method: "GET", accept: "json", assertOk: true });
      const data = z.object({ invite_link: z.string(), success: z.boolean() }).parse(await response.json());
      const origin = window.location.origin;
      return { invite_link: `${origin}/invite/${data.invite_link}` };
    },
    enabled: !!open && !!company.id,
    refetchOnWindowFocus: false,
  });

  const resetInviteLinkMutation = useMutation({
    mutationFn: async () => {
      await request({
        url: reset_company_invite_links_path(company.id),
        method: "PATCH",
        accept: "json",
        assertOk: true,
      });
    },
    onSuccess: async () => {
      await refetch();
      setShowResetLinkModal(false);
    },
  });

  const resetInviteLink = () => {
    resetInviteLinkMutation.mutate();
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
