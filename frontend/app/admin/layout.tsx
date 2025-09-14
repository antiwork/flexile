"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PropsWithChildren } from "react";
import { useCurrentUser } from "@/global";
import { UserDataProvider } from "@/trpc/client";

export default function Layout({ children }: PropsWithChildren) {
  const searchParams = useSearchParams();
  // Don't require authentication to unimpersonate (user=null if impersonation session expired)
  if (searchParams.get("actor_token") === "null") return children;

  return (
    <UserDataProvider>
      <AdminLayout>{children}</AdminLayout>
    </UserDataProvider>
  );
}

function AdminLayout({ children }: PropsWithChildren) {
  const user = useCurrentUser();
  const { data: session } = useSession();
  const primarySession = session?.user.primaryToken === session?.user.jwt;
  const router = useRouter();

  if (primarySession && !user.teamMember) {
    router.replace("/dashboard");
    return null;
  }

  return children;
}
