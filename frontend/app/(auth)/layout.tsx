"use client";

import { redirect, RedirectType } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);

  const isValidRedirectUrl = (url: string) => url.startsWith("/") && !url.startsWith("//");
  useEffect(() => {
    if (user && typeof window !== "undefined") {
      const redirectUrl = new URLSearchParams(window.location.search).get("redirect_url");
      const targetUrl = redirectUrl && isValidRedirectUrl(redirectUrl) ? redirectUrl : "/dashboard";
      throw redirect(targetUrl, RedirectType.replace);
    }
  }, [user]);

  return (
    <div className="flex h-full flex-col">
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
        <div className="my-auto grid w-full max-w-md gap-4 pt-7 print:my-0 print:max-w-full">{children}</div>
      </main>
    </div>
  );
}
