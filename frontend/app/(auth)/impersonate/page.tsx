"use client";

import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const param = searchParams.get("actor_token");
  const actorToken = param === "null" ? null : param;
  const { data: session, status, update } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    // Authenticated (impersonation session) => redirect to dashboard
    if (actorToken === session?.user.actorToken) {
      window.location.href = "/dashboard";
      return;
    }

    // Authenticated (impersonation-only session) => delete cookie completely
    if (!session?.user.primaryToken && actorToken === null) {
      void signOut({ redirect: false }).then(() => {
        window.location.href = "/login";
      });
      return;
    }

    // Unauthenticated => sign in with actor token
    if (status === "unauthenticated") void signIn("impersonation", { actorToken });
    // Authenticated (primary session) => update actor token
    else void update({ actorToken });
  }, [status, actorToken, session, update]);

  return (
    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
      <div className="border-muted mb-4 size-8 animate-spin rounded-full border-4 border-t-black" />
      <div className="text-md font-semibold">Setting up your session...</div>
    </div>
  );
}
