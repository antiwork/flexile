"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import BrandedLayout from "@/app/(public)/layout";

function ImpersonateHandler() {
  const { data: session, status, update } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("actor_token");
  const actorToken = param === "null" ? null : param;

  useEffect(() => {
    if (status === "loading") return;

    const impersonating = actorToken === session?.user.actorToken;
    if (!param || impersonating) return router.replace("/dashboard");

    void update({ actorToken });
  }, [status, actorToken, session, update]);

  return (
    <div className="bg-background flex flex-col items-center gap-4 rounded-xl p-8 shadow-lg">
      <div className="border-muted size-8 animate-spin rounded-full border-4 border-t-black dark:border-t-white" />
      <div className="text-md font-semibold">Setting up your session...</div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense>
      <BrandedLayout>
        <ImpersonateHandler />
      </BrandedLayout>
    </Suspense>
  );
}
