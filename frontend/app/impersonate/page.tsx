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
  const { update } = useSession();

  useEffect(() => {
    const actorToken = searchParams.get("actor_token");

    if (!actorToken) {
      window.location.href = "/dashboard";
      return;
    }

    void update({ actorToken: actorToken === "null" ? null : actorToken }).finally(() => {
      window.location.href = "/dashboard";
    });
  }, []);

  return (
    <PublicLayout>
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <div className="border-muted mb-4 h-8 w-8 animate-spin rounded-full border-4 border-t-black" />
        <div className="text-md font-semibold">Setting up your session...</div>
      </div>
    </PublicLayout>
  );
}
