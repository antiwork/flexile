"use client";

import { useConversations, useCreateConversation } from "@helperai/react";
import { CircleCheck, Paperclip, SendIcon, X } from "lucide-react";
import React, { useRef, useState } from "react";
import { helperTools } from "@/app/(dashboard)/support/tools";
import { DashboardHeader } from "@/components/DashboardHeader";
import { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";

interface ConversationsListProps {
  onSelectConversation: (slug: string) => void;
}

export const ConversationsList = ({ onSelectConversation }: ConversationsListProps) => {
  const { data: conversationsData, isLoading: loading, refetch } = useConversations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const company = useCurrentCompany();
  const user = useCurrentUser();

  const createConversation = useCreateConversation({
    onSuccess: () => {
      setIsModalOpen(false);
      setMessage("");
      setAttachments([]);
    },
  });

  const conversations = conversationsData?.conversations || [];

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

    // TODO: Shouldn't be necessary, the client invalidate doesn't work for some reason
    void refetch();
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

  return (
    <>
      <DashboardHeader
        title="Support center"
        headerActions={
          <Button onClick={() => setIsModalOpen(true)} size="small">
            Contact support
          </Button>
        }
      />

      <div className="grid gap-4">
        {loading ? (
          <TableSkeleton columns={3} />
        ) : conversations.length === 0 ? (
          <div className="mx-4">
            <Placeholder icon={CircleCheck}>
              No support tickets found. Create your first ticket to get started.
            </Placeholder>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conversation) => (
                <TableRow
                  key={conversation.slug}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onSelectConversation(conversation.slug)}
                >
                  <TableCell className={`font-medium ${conversation.isUnread ? "font-bold" : ""}`}>
                    <div className="flex items-center gap-2">
                      {conversation.isUnread ? (
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                      ) : null}
                      {conversation.subject}
                    </div>
                  </TableCell>
                  <TableCell className={conversation.isUnread ? "font-bold" : ""}>
                    {conversation.messageCount}
                  </TableCell>
                  <TableCell className={conversation.isUnread ? "font-bold" : ""}>
                    {new Date(conversation.latestMessageAt ?? conversation.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                  size="small"
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
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <MutationStatusButton
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
    </>
  );
};
