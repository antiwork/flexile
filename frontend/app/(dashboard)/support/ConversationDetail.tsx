"use client";

import { HelperClient } from "@helperai/client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelperChat } from "./HelperChat";

interface ConversationDetailProps {
  client: HelperClient;
  conversationSlug: string;
  onBack: () => void;
}

interface ConversationDetails {
  slug: string;
  subject: string | null;
  isEscalated: boolean;
  messages: {
    createdAt: string;
    id: string;
    content: string;
    role: "user" | "staff" | "assistant";
    staffName: string | null;
    reactionType: "thumbs-up" | "thumbs-down" | null;
    reactionFeedback: string | null;
    reactionCreatedAt: string | null;
  }[];
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({ client, conversationSlug, onBack }) => {
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadConversation();
  }, [conversationSlug, client]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const details = await client.conversations.get(conversationSlug);
      setConversation(details);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading conversation...</div>;
  }

  if (!conversation) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          ← Back to tickets
        </Button>
        <div>Conversation not found</div>
      </div>
    );
  }

  const createdAt = conversation.messages[0]?.createdAt ?? new Date().toISOString();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={onBack}>
          ← Back to tickets
        </Button>
        <h1 className="text-3xl font-bold">{conversation.subject || "Untitled conversation"}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Created:</span> {new Date(createdAt).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Messages:</span> {conversation.messages.length}
            </div>
          </div>
        </CardContent>
      </Card>

      <HelperChat client={client} conversation={conversation} onConversationUpdate={setConversation} />
    </div>
  );
};
