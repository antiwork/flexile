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
  const [selectedConversationSlug, setSelectedConversationSlug] = useQueryState("id", {
    history: "push",
  });
  const { data: session, isLoading } = useHelperSession();

  if (isLoading || !session) return null;

  return (
    <HelperClientProvider host="https://help.flexile.com" session={session}>
      {selectedConversationSlug ? (
        <ConversationDetail conversationSlug={selectedConversationSlug} />
      ) : (
        <ConversationsList onSelectConversation={(slug) => void setSelectedConversationSlug(slug)} />
      )}
    </HelperClientProvider>
  );
};
