"use client";

import { HelperClientProvider } from "@helperai/react";
import { useQueryState } from "nuqs";
import { trpc } from "@/trpc/client";
import { ConversationDetail } from "./ConversationDetail";
import { ConversationsList } from "./ConversationsList";

export const useHelperSession = () =>
  // Would be nice to do this in a server component so we don't need to wait for it to load
  trpc.support.createHelperSession.useQuery(
    {},
    {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: Infinity,
    },
  );

export const SupportPortal = () => {
  const [selectedConversationSlug, setSelectedConversationSlug] = useQueryState("id");
  const { data: session, isLoading } = useHelperSession();

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
            onBack={() => void setSelectedConversationSlug(null)}
          />
        ) : (
          <ConversationsList onSelectConversation={(slug) => void setSelectedConversationSlug(slug)} />
        )}
      </div>
    </HelperClientProvider>
  );
};
