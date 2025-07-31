"use client";

import { type ConversationDetails } from "@helperai/client";
import { MessageContent, useChat } from "@helperai/react";
import { Paperclip, Send, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

interface HelperChatProps {
  conversation: ConversationDetails;
}

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="max-w-xs rounded-lg bg-gray-100 px-4 py-2 text-gray-900 lg:max-w-md">
      <div className="flex items-center space-x-1">
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }}></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }}></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }}></div>
      </div>
    </div>
  </div>
);

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

export const HelperChat = ({ conversation }: HelperChatProps) => {
  const utils = trpc.useUtils();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const { messages, input, handleInputChange, handleSubmit, agentTyping } = useChat({
    conversation,
    tools: {
      getInvoices: {
        description: "Fetch a list of recent invoices",
        parameters: {},
        execute: async () => {
          const invoices = await utils.invoices.list.fetch({
            companyId: company.id,
            contractorId: user.roles.worker?.id,
          });
          return invoices.map((invoice) => ({
            id: invoice.id,
            number: invoice.invoiceNumber,
            // The AI SDK crashes if we return a BigInt
            totalAmountInUsdCents: Number(invoice.totalAmountInUsdCents),
            date: invoice.invoiceDate,
            status: invoice.status,
          }));
        },
      },
    },
    ai: {
      maxSteps: 3,
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachments.length > 0) handleFormSubmit(e);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    // Create a DataTransfer object to build a proper FileList
    const dataTransfer = new DataTransfer();
    attachments.forEach((file) => dataTransfer.items.add(file));

    const options = attachments.length > 0 ? { experimental_attachments: dataTransfer.files } : {};

    handleSubmit(e, options);
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
  }, [messages, agentTyping]);

  const lastMessage = messages[messages.length - 1];
  const showAgentTypingIndicator = lastMessage && !lastMessage.content && lastMessage.role !== "user";

  return (
    <>
      <div>
        {messages.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No messages yet. Start the conversation!</div>
        ) : (
          messages
            .filter((message) => !!message.content)
            .map((message, index, filteredMessages) => (
              <div
                key={message.id}
                className={`border-muted hover:bg-muted/15 cursor-pointer px-2 py-4 ${
                  index < filteredMessages.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"></div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-black">
                        {message.role === "user" ? user.name : message.staffName || "Flexile support"}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {new Date(message.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                      </span>
                    </div>
                    <div className="text-muted-foreground max-w-3xl">
                      <MessageContent message={message} className="text-sm" />
                      <MessageAttachments attachments={[...message.publicAttachments, ...message.privateAttachments]} />
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
        {showAgentTypingIndicator ? <TypingIndicator /> : null}
        {agentTyping ? <div className="text-center text-xs text-gray-500">Agent is typing...</div> : null}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleFormSubmit} className="bg-background w-full max-w-4xl space-y-2 p-4">
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
            value={input}
            onChange={handleInputChange}
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
          <Button type="submit" disabled={!input.trim() && attachments.length === 0} size="small">
            <Send className="size-4" />
            Send reply
          </Button>
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
    </>
  );
};
