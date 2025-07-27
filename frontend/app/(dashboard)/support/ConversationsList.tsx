"use client";

import { HelperClient } from "@helperai/client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ConversationsListProps {
  client: HelperClient;
  onSelectConversation: (slug: string) => void;
}

interface Conversation {
  slug: string;
  subject: string;
  createdAt: string;
  latestMessage: string | null;
  latestMessageAt: string | null;
  messageCount: number;
}

export const ConversationsList: React.FC<ConversationsListProps> = ({ client, onSelectConversation }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, [client]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await client.conversations.list();
      setConversations(response.conversations);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      setCreating(true);
      const newConversation = await client.conversations.create({
        subject: "New support ticket",
      });
      onSelectConversation(newConversation.conversationSlug);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create ticket:", error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div>Loading conversations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Support tickets</h2>
        <Button onClick={() => void handleCreateTicket()} disabled={creating}>
          {creating ? "Creating..." : "New ticket"}
        </Button>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              No support tickets found. Create your first ticket to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your support tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.slug}>
                    <TableCell className="font-medium">{conversation.subject}</TableCell>
                    <TableCell>{conversation.messageCount}</TableCell>
                    <TableCell>
                      {conversation.latestMessageAt
                        ? new Date(conversation.latestMessageAt).toLocaleDateString()
                        : new Date(conversation.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="small" onClick={() => onSelectConversation(conversation.slug)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
