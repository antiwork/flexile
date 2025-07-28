"use client";

import { HelperClientProvider } from "@helperai/react";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import { ConversationDetail } from "./ConversationDetail";
import { ConversationsList } from "./ConversationsList";

export const SupportPortal = () => {
  const [selectedConversationSlug, setSelectedConversationSlug] = useState<string | null>(null);

  const { data: session, isLoading } = trpc.support.createHelperSession.useQuery();

  if (isLoading || !session) {
    return <div>Loading support portal...</div>;
  }

  return (
    <HelperClientProvider host="https://help.flexile.com" session={session}>
      <div className="container mx-auto p-6">
        <h1 className="mb-6 text-3xl font-bold">Customer support</h1>

        {selectedConversationSlug ? (
          <ConversationDetail
            conversationSlug={selectedConversationSlug}
            onBack={() => setSelectedConversationSlug(null)}
          />
        ) : (
          <ConversationsList onSelectConversation={setSelectedConversationSlug} />
        )}
      </div>
    </HelperClientProvider>
  );
};
