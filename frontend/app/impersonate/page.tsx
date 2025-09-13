"use client";

import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import PublicLayout from "@/app/(public)/layout";

export default function ImpersonatePage() {
  return (
    <Suspense>
      <PublicLayout>
        <SessionSetup />
      </PublicLayout>
    </Suspense>
  );
}

function SessionSetup() {
  const searchParams = useSearchParams();
  const { update, status, data: session } = useSession();
  const param = searchParams.get("actor_token");
  const actorToken = param === "null" ? null : param;

  useEffect(() => {
    if (status === "loading") return;
    if (!param || actorToken === session?.user.actorToken) {
      window.location.href = "/dashboard";
      return;
    }
    // If this is an impersonation-only session (no primary token present),
    // fully sign the user out to prevent leaving a dangling impersonation session.
    if (!session?.user.primaryToken && actorToken === null) {
      void signOut({ redirect: false }).then(() => {
        window.location.href = "/login";
      });
      return;
    }

    if (status === "unauthenticated") void signIn("impersonation", { actorToken });
    else void update({ actorToken });
  }, [status]);

  return (
    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
      <div className="border-muted mb-4 size-8 animate-spin rounded-full border-4 border-t-black" />
      <div className="text-md font-semibold">Setting up your session...</div>
    </div>
  );
}
