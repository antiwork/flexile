"use client";

import { redirect, RedirectType, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  const searchParams = useSearchParams();

  const isValidRedirectUrl = (url: string) => url.startsWith("/") && !url.startsWith("//");
  useEffect(() => {
    if (user) {
      const redirectUrl = searchParams.get("redirect_url");
      const targetUrl = redirectUrl && isValidRedirectUrl(redirectUrl) ? redirectUrl : "/dashboard";
      throw redirect(targetUrl, RedirectType.replace);
    }
  }, [user, searchParams]);

  return (
    <div className="flex h-full flex-col bg-gray-50/50">
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
        <div className="mt-40 grid w-full max-w-md gap-4 print:my-0 print:max-w-full">{children}</div>
      </main>
    </div>
  );
}
