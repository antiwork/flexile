"use client";

import { useChat } from "@ai-sdk/react";
import { HelperClient } from "@helperai/client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface HelperChatProps {
  client: HelperClient;
  conversation: {
    slug: string;
    subject: string | null;
    messages: {
      createdAt: string;
      id: string;
      content: string;
      role: "user" | "staff" | "assistant";
      staffName: string | null;
    }[];
  };
  onConversationUpdate: (conversation: any) => void;
}

export const HelperChat: React.FC<HelperChatProps> = ({ client, conversation, onConversationUpdate }) => {
  const { messages, setMessages, input, handleInputChange, handleSubmit } = useChat({
    ...client.chat.handler({ conversation }),
  });

  const [isListening, setIsListening] = useState(false);

  // Initialize messages from conversation
  useEffect(() => {
    const formattedMessages = client.chat.messages(conversation.messages);
    setMessages(formattedMessages);
  }, [conversation.messages, client, setMessages]);

  // Set up real-time listeners
  useEffect(() => {
    setIsListening(true);
    const unlisten = client.conversations.listen(conversation.slug, {
      onSubjectChanged: (subject) => {
        onConversationUpdate((prevConversation: any) => (prevConversation ? { ...prevConversation, subject } : null));
      },
      onHumanReply: (message) => {
        setMessages((prev) => [...prev, message]);
      },
    });

    return () => {
      setIsListening(false);
      unlisten();
    };
  }, [conversation.slug, client, onConversationUpdate, setMessages]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-gray-500">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((message, index) => {
                const { content, role, staffName, createdAt } = message;
                const isUser = role === "user";

                return (
                  <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                        isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="text-sm">{content}</div>
                      <div className="mt-1 text-xs opacity-70">
                        {staffName && role === "staff" ? <span className="font-medium">{staffName} • </span> : null}
                        {role === "assistant" && <span className="font-medium">AI Assistant • </span>}
                        {createdAt ? new Date(createdAt).toLocaleTimeString() : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex space-x-2">
        <Input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim()}>
          Send
        </Button>
      </form>

      {isListening ? <div className="text-center text-xs text-gray-500">Connected to real-time updates</div> : null}
    </div>
  );
};
