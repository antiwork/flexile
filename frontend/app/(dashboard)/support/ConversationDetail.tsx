"use client";

import { useConversation } from "@helperai/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
      <DashboardHeader
        title={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link href="/support">Support center</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{conversation?.subject}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      {conversation ? <HelperChat conversation={conversation} /> : null}
    </>
  );
};
