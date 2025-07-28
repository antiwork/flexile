"use client";

import { useConversation } from "@helperai/react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelperChat } from "./HelperChat";

interface ConversationDetailProps {
  conversationSlug: string;
  onBack: () => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({ conversationSlug, onBack }) => {
  const { data: conversation, isLoading: loading } = useConversation(conversationSlug, {
    enableRealtime: true,
    markRead: true,
  });

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

      <HelperChat conversation={conversation} />
    </div>
  );
};
