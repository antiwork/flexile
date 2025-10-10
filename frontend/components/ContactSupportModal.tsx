"use client";

import { HelperClientProvider, useCreateConversation } from "@helperai/react";
import { Paperclip, SendIcon, X } from "lucide-react";
import React, { useRef, useState } from "react";
import { useHelperSession } from "@/app/(dashboard)/support/SupportPortal";
import { helperTools } from "@/app/(dashboard)/support/tools";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";

interface ContactSupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactSupportModal = ({ open, onOpenChange }: ContactSupportModalProps) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const { data: session, isLoading } = useHelperSession();

  const createConversation = useCreateConversation({
    onSuccess: () => {
      onOpenChange(false);
      setSubject("");
      setMessage("");
      setAttachments([]);
    },
  });

  const handleSubmit = async () => {
    if (!message.trim() && attachments.length === 0) return;

    await createConversation.mutateAsync({
      subject,
      message: {
        content: message.trim(),
        attachments,
        tools: helperTools({ companyId: company.id, contractorId: user.roles.worker?.id }),
      },
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading || !session) return null;

  return (
    <HelperClientProvider host="https://help.flexile.com" session={session}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How can we help you today?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="mt-1"
              />
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your issue or question..."
                className="mt-4 min-h-40 resize-none pr-12"
                rows={4}
              />
              <div className="absolute right-2 bottom-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 p-0"
                >
                  <Paperclip className="size-4" />
                </Button>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-sm hover:bg-gray-100/50"
                  >
                    <span className="max-w-28 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="cursor-pointer text-gray-500 hover:text-gray-700"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.txt"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <MutationStatusButton
              idleVariant="primary"
              mutation={createConversation}
              disabled={!message.trim() && attachments.length === 0}
              onClick={() => void handleSubmit()}
            >
              <SendIcon className="mr-1 size-4" />
              Send
            </MutationStatusButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HelperClientProvider>
  );
};
