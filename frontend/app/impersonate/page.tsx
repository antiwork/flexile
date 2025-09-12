"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import PublicLayout from "@/app/(public)/layout";

export default function ImpersonatePage() {
  return (
    <Suspense>
      <ImpersonationSessionSetup />
    </Suspense>
  );
}

function ImpersonationSessionSetup() {
  const searchParams = useSearchParams();
  const { update, status, data: session } = useSession();
  const param = searchParams.get("actor_token");
  const actorToken = param === "null" ? null : param;

  useEffect(() => {
    if (status === "loading") return;
    if (!param || actorToken === session?.user.actorToken) return window.location.replace("/dashboard");

    void update({ actorToken }).finally(() => {
      window.location.replace("/dashboard");
    });
  }, [status]);

  return (
    <PublicLayout>
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <div className="border-muted mb-4 size-8 animate-spin rounded-full border-4 border-t-black" />
        <div className="text-md font-semibold">Setting up your session...</div>
      </div>
    </PublicLayout>
  );
}
