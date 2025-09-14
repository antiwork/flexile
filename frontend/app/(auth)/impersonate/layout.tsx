"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense } from "react";
import type { PropsWithChildren } from "react";
import BrandedLayout from "@/app/(public)/layout";
import { useCurrentUser } from "@/global";
import { UserDataProvider } from "@/trpc/client";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Suspense>
      <BrandedLayout>
        <Content>{children}</Content>
      </BrandedLayout>
    </Suspense>
  );
}

function Content({ children }: PropsWithChildren) {
  const searchParams = useSearchParams();

  // Don't protect unimpersonate page
  if (searchParams.get("actor_token") === "null") return children;

  return (
    <UserDataProvider>
      <Protected>{children}</Protected>
    </UserDataProvider>
  );
}

function Protected({ children }: PropsWithChildren) {
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
