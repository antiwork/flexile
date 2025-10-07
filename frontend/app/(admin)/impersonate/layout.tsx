"use client";

import { useSearchParams } from "next/navigation";
import { type PropsWithChildren, Suspense } from "react";
import { UserDataProvider } from "@/trpc/client";

function ImpersonateLayout({ children }: PropsWithChildren) {
  const searchParams = useSearchParams();
  const unimpersonating = searchParams.get("actor_token") === "null";

  if (unimpersonating) return children;
  return <UserDataProvider>{children}</UserDataProvider>;
}

export default function Layout({ children }: PropsWithChildren) {
  return (
    <Suspense>
      <ImpersonateLayout>{children}</ImpersonateLayout>
    </Suspense>
  );
}
