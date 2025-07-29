"use client";

import { useConversations, useCreateConversation } from "@helperai/react";
import { CircleCheck, Plus } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ConversationsListProps {
  onSelectConversation: (slug: string) => void;
}

export const ConversationsList = ({ onSelectConversation }: ConversationsListProps) => {
  const { data: conversationsData, isLoading: loading } = useConversations();
  const createConversation = useCreateConversation({
    onSuccess: (data) => {
      onSelectConversation(data.conversationSlug);
    },
  });

  const conversations = conversationsData?.conversations || [];

  return (
    <>
      <DashboardHeader
        title="Support tickets"
        headerActions={
          <Button
            onClick={() => createConversation.mutate({})}
            variant="outline"
            size="small"
            disabled={createConversation.isPending}
          >
            <Plus className="size-4" />
            {createConversation.isPending ? "Creating..." : "New ticket"}
          </Button>
        }
      />

      <div className="grid gap-4">
        {loading ? (
          <TableSkeleton columns={3} />
        ) : conversations.length === 0 ? (
          <Placeholder icon={CircleCheck}>
            No support tickets found. Create your first ticket to get started.
          </Placeholder>
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
    </>
  );
};
