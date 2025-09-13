"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { request } from "@/utils/request";
import { admin_impersonation_index_path } from "@/utils/routes";

export default function ImpersonatePage() {
  const searchParams = useSearchParams();

  const userIdentifier = searchParams.get("user_identifier");
  const actorToken = searchParams.get("actor_token");

  if (!actorToken) return <Redirect userIdentifier={userIdentifier} />;
  return <SessionSetup actorToken={actorToken === "null" ? null : actorToken} />;
}

function Redirect({ userIdentifier }: { userIdentifier: string | null }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        method: "POST",
        url: admin_impersonation_index_path(),
        accept: "json",
        jsonData: { email: userIdentifier },
        assertOk: true,
      });
      const data = z.object({ redirect_url: z.string().url() }).parse(await response.json());
      window.location.href = data.redirect_url;
    },
  });

  useEffect(() => {
    mutation.mutate();
  }, []);

  if (mutation.error) return <Error message={mutation.error.message} />;
  return <Loading message="Starting impersonation..." />;
}

function SessionSetup({ actorToken }: { actorToken: string | null }) {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    // Authenticated (impersonation session)
    if (actorToken === session?.user.actorToken) {
      window.location.href = "/dashboard";
      return;
    }

    // Remove cookie to prevent leaving a dangling impersonation session.
    if (!session?.user.primaryToken && actorToken === null) {
      void signOut({ redirect: false }).then(() => {
        window.location.href = "/login";
      });
      return;
    }

    // Unauthenticated
    if (status === "unauthenticated") void signIn("impersonation", { actorToken });
    // Authenticated (primary session)
    else void update({ actorToken });
  }, [status, actorToken, session, update]);

  return <Loading message="Setting up your session..." />;
}

function Error({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
      <div className="mb-4 font-semibold">{message}</div>
      <Button variant="outline" size="small" asChild>
        <Link href="/dashboard">Go home</Link>
      </Button>
    </div>
  );
}

function Loading({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white p-8 shadow-lg">
      <div className="border-muted mb-4 size-8 animate-spin rounded-full border-4 border-t-black" />
      <div className="text-md font-semibold">{message}</div>
    </div>
  );
}
