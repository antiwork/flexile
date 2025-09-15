"use client";

import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import BrandedLayout from "@/app/(public)/layout";

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const param = searchParams.get("actor_token");
  const actorToken = param === "null" ? null : param;
  const { data: session, status, update } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    // Already impersonating - redirect to dashboard
    if (actorToken === session?.user.actorToken) {
      window.location.href = "/dashboard";
      return;
    }

    // Expired impersonation session - clear auth and redirect to login
    if (!session?.user.primaryToken && actorToken === null) {
      void signOut({ redirect: false }).then(() => {
        window.location.href = "/login";
      });
      return;
    }

    // Start new impersonation or update existing session
    if (status === "unauthenticated") void signIn("impersonation", { actorToken });
    else void update({ actorToken });
  }, [status, actorToken, session, update]);

  return (
    <BrandedLayout>
      <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
        <div className="border-muted mb-4 size-8 animate-spin rounded-full border-4 border-t-black" />
        <div className="text-md font-semibold">Setting up your session...</div>
      </div>
    </BrandedLayout>
  );
}
