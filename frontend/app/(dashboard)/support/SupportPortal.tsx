"use client";

import { HelperClient } from "@helperai/client";
import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { ConversationDetail } from "./ConversationDetail";
import { ConversationsList } from "./ConversationsList";

export const SupportPortal = () => {
  const [selectedConversationSlug, setSelectedConversationSlug] = useState<string | null>(null);

  const { data: session, isLoading } = trpc.support.createHelperSession.useQuery();

  const helperClient = useMemo(() => {
    if (!session) return null;
    return new HelperClient({
      host: "https://help.flexile.com",
      ...session,
    });
  }, [session]);

  if (isLoading || !helperClient) {
    return <div>Loading support portal...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Customer support</h1>

      {selectedConversationSlug ? (
        <ConversationDetail
          client={helperClient}
          conversationSlug={selectedConversationSlug}
          onBack={() => setSelectedConversationSlug(null)}
        />
      ) : (
        <ConversationsList client={helperClient} onSelectConversation={setSelectedConversationSlug} />
      )}
    </div>
  );
};
