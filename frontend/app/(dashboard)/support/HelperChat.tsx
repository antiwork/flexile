"use client";

import { type ConversationDetails, type Message } from "@helperai/client";
import { MessageContent, useCreateMessage, useRealtimeEvents } from "@helperai/react";
import { Paperclip, Send, User, X } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { cn } from "@/utils";
import { helperTools } from "./tools";

interface HelperChatProps {
  conversation: ConversationDetails;
}

const MessageAttachments = ({
  attachments,
}: {
  attachments: { name: string | null; contentType: string | null; url: string }[];
}) => {
  const validAttachments = attachments.filter((att) => att.name !== null);
  if (validAttachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {validAttachments.map((attachment, index) => (
        <a
          key={index}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-sm text-black hover:bg-gray-100/50"
        >
          <Paperclip className="size-3" />
          <span className="max-w-40 truncate">{attachment.name}</span>
        </a>
      ))}
    </div>
  );
};

const MessageRow = ({
  message,
  userName,
  isLastMessage,
}: {
  message: Message;
  userName: string;
  isLastMessage: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(isLastMessage);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={cn(
        "border-muted hover:bg-muted/10 cursor-pointer px-4 py-4",
        !isLastMessage ? "border-b" : "",
        message.role === "user" ? "" : "bg-muted/15",
      )}
      onClick={toggleExpansion}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            message.role === "user" ? "bg-muted/15" : "bg-black",
          )}
        >
          {message.role === "user" ? (
            <User className="size-4" />
          ) : (
            <Image src="/logo-icon.svg" alt="Flexile" width={32} height={32} className="size-6 invert" />
          )}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-black">
              {message.role === "user" ? userName : message.staffName || "Flexile support"}
            </span>
            <span className="text-muted-foreground text-sm">
              {new Date(message.createdAt).toLocaleString(undefined, { timeStyle: "short", dateStyle: "short" })}
            </span>
          </div>
          <div
            className={`max-w-3xl ${isExpanded ? "py-2" : "text-muted-foreground"} ${
              !isExpanded ? "line-clamp-1" : ""
            }`}
          >
            <MessageContent message={message} className="text-sm" />
            <MessageAttachments attachments={[...message.publicAttachments, ...message.privateAttachments]} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const HelperChat = ({ conversation }: HelperChatProps) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [content, setContent] = useState("");

  const createMessage = useCreateMessage();

  useRealtimeEvents(conversation.slug);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (content.trim() || attachments.length > 0) void handleFormSubmit(e);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createMessage.mutateAsync({
      conversationSlug: conversation.slug,
      content,
      attachments,
      tools: helperTools({ companyId: company.id, contractorId: user.roles.worker?.id }),
    });

    setContent("");
    setAttachments([]);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages.length]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {conversation.messages.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No messages yet. Start the conversation!</div>
      ) : (
        conversation.messages
          .filter((message) => !!message.content)
          .map((message, index, filteredMessages) => (
            <MessageRow
              key={message.id}
              message={message}
              userName={user.name}
              isLastMessage={index === filteredMessages.length - 1}
            />
          ))
      )}

      <form onSubmit={(e) => void handleFormSubmit(e)} className="bg-background w-full max-w-4xl space-y-2 p-4">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex w-fit items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-sm hover:bg-gray-100/50"
              >
                <span className="max-w-36 truncate">{file.name}</span>
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
        <div className="relative">
          <Textarea
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="max-h-50 min-h-26 w-full resize-none pb-10"
            autoFocus
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
        <div className="mt-4 flex justify-end">
          <MutationStatusButton
            mutation={createMessage}
            disabled={!content.trim() && attachments.length === 0}
            size="small"
            type="submit"
          >
            <Send className="size-4" />
            Send reply
          </MutationStatusButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt"
        />
      </form>
      <div ref={messagesEndRef} />
    </div>
  );
};
