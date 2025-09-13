"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCurrentUser } from "@/global";
import { UserDataProvider } from "@/trpc/client";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserDataProvider>
      <AdminLayout>{children}</AdminLayout>
    </UserDataProvider>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const session = useSession();
  const primarySession = session.data?.user.primaryToken === session.data?.user.jwt;
  const router = useRouter();

  if (primarySession && !user.teamMember) {
    router.replace("/dashboard");
    return null;
  }

  return children;
}
