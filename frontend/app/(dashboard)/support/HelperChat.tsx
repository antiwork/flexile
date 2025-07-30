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
  isUser,
}: {
  attachments: { name: string | null; contentType: string | null; url: string }[];
  isUser: boolean;
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
          className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
            isUser ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
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
      <div className="space-y-4 pb-24">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No messages yet. Start the conversation!</div>
        ) : (
          messages
            .filter((message) => !!message.content)
            .map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                    message.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <MessageContent message={message} className="text-sm" />
                  <MessageAttachments
                    attachments={[...message.publicAttachments, ...message.privateAttachments]}
                    isUser={message.role === "user"}
                  />
                  <div className="mt-1 text-xs opacity-70">
                    {message.staffName && message.role === "staff" ? (
                      <span className="font-medium">{message.staffName} • </span>
                    ) : null}
                    {new Date(message.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                  </div>
                </div>
              </div>
            ))
        )}
        {showAgentTypingIndicator ? <TypingIndicator /> : null}
        {agentTyping ? <div className="text-center text-xs text-gray-500">Agent is typing...</div> : null}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="bg-background border-border absolute right-0 bottom-0 left-0 space-y-2 border-t p-4"
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm">
                <span className="max-w-32 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex space-x-2">
          <Textarea
            rows={2}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1"
            autoFocus
          />
          <div className="flex flex-col space-y-2">
            <Button type="button" variant="outline" size="small" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="size-4" />
            </Button>
            <Button type="submit" disabled={!input.trim() && attachments.length === 0}>
              <Send className="size-4" />
            </Button>
          </div>
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
