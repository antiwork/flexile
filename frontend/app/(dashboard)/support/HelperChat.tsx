"use client";

import { type ConversationDetails } from "@helperai/client";
import { MessageContent, useChat } from "@helperai/react";
import { Send } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface HelperChatProps {
  conversation: ConversationDetails;
}

export const HelperChat: React.FC<HelperChatProps> = ({ conversation }) => {
  const { messages, input, handleInputChange, handleSubmit, agentTyping } = useChat({ conversation });

  return (
    <>
      <div className="space-y-4">
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
        {agentTyping ? <div className="text-center text-xs text-gray-500">Agent is typing...</div> : null}
      </div>

      <form onSubmit={handleSubmit} className="absolute right-4 bottom-4 left-4 flex space-x-2">
        <Textarea
          rows={2}
          value={input}
          onChange={handleInputChange}
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
