"use client";
import { useUserStore } from "@/global";
import { redirect, RedirectType, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";

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

  return children;
}
