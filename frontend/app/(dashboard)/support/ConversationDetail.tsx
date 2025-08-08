"use client";

import { useConversation } from "@helperai/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
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
    <div className="flex max-h-dvh flex-col">
      <div className="border-muted border-b pb-4">
        <DashboardHeader
          title={
            <div className="flex items-center gap-2 text-xl">
              <Link href="/support" className="text-muted-foreground">
                Support center
              </Link>
              <ChevronRight className="text-muted-foreground size-5" />
              <span>{conversation?.subject}</span>
            </div>
          }
        />
      </div>
      {conversation ? <HelperChat conversation={conversation} /> : null}
    </div>
  );
};
