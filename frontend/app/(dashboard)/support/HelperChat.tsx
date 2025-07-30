"use client";

import { type ConversationDetails } from "@helperai/client";
import { MessageContent, useChat } from "@helperai/react";
import { Send } from "lucide-react";
import React, { useEffect, useRef } from "react";
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

export const HelperChat: React.FC<HelperChatProps> = ({ conversation }) => {
  const utils = trpc.useUtils();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      if (input.trim()) handleSubmit(e);
    }
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
            .map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                    message.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <MessageContent message={message} className="text-sm" />
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

      <form onSubmit={handleSubmit} className="bg-background absolute right-0 bottom-0 left-0 flex space-x-2 p-4">
        <Textarea
          rows={2}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={!input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </>
  );
};
