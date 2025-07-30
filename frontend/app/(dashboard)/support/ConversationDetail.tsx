"use client";

import { useConversation } from "@helperai/react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { HelperChat } from "./HelperChat";

interface ConversationDetailProps {
  conversationSlug: string;
}

export const ConversationDetail = ({ conversationSlug }: ConversationDetailProps) => {
  const router = useRouter();
  const { data: conversation, isLoading: loading } = useConversation(conversationSlug);

  if (!loading && !conversation) {
    router.push("/support");
    return null;
  }

  return (
    <>
      <DashboardHeader title={conversation?.subject || "Chat"} />
      {conversation ? <HelperChat conversation={conversation} /> : null}
    </>
  );
};
