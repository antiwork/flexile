"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { X, Copy } from "lucide-react";
import { trpc } from "@/trpc/client";
import { useCurrentCompany } from "@/global";

interface InviteLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteLinkModal({ open, onOpenChange }: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  const company = useCurrentCompany();
  const { data: inviteLinkData, refetch } = trpc.contractorInviteLinks.get.useQuery({ companyId: company.id });

  const resetMutation = trpc.contractorInviteLinks.reset.useMutation({
    onSuccess: () => {
      void refetch();
      setShowResetConfirmation(false);
      setCopied(false);
    },
  });

  const inviteLink = inviteLinkData?.url ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        // TODO (techdebt): Replace with proper error handling
      }
    }
  };

  const handleResetClick = () => {
    setShowResetConfirmation(true);
  };

  const handleResetConfirm = () => {
    resetMutation.mutate({ companyId: company.id });
  };

  const handleResetCancel = () => {
    setShowResetConfirmation(false);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setShowResetConfirmation(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">
            {showResetConfirmation ? "Reset invite link?" : "Invite link"}{" "}
          </DialogTitle>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {showResetConfirmation ? (
            <>
              <p className="text-base leading-[1.6875] text-gray-700">
                Resetting the link will deactivate the current invite. If you've already shared it, others may no longer
                be able to join your workspace.
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleResetCancel}>
                  Cancel
                </Button>
                <Button onClick={handleResetConfirm}>Reset link</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base leading-[1.6875] text-gray-700">
                Share a link so contractors can add their details, set a rate, and sign their own contract.
              </p>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <label htmlFor="invite-link" className="text-sm font-medium text-gray-900">
                    Link
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="invite-link"
                        type="text"
                        value={inviteLink}
                        disabled
                        className="disabled:opacity-100"
                      />
                      <Button onClick={() => void handleCopy()} size="small" variant={copied ? "success" : "default"}>
                        {copied ? (
                          "Copied!"
                        ) : (
                          <>
                            <Copy /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600">
                      Anyone with this link can join your workspace.{" "}
                      <button onClick={handleResetClick} className="text-blue-600 hover:underline">
                        Reset link.
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
