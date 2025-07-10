"use client";
import { redirect, RedirectType, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";
import { useAuthSession } from "@/lib/session";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  const { isAuthenticated } = useAuthSession();
  const searchParams = useSearchParams();

  const isValidRedirectUrl = (url: string) => url.startsWith("/") && !url.startsWith("//");

  useEffect(() => {
    // If authenticated via either system, redirect to dashboard
    if (user || isAuthenticated) {
      const redirectUrl = searchParams.get("redirect_url");
      const targetUrl = redirectUrl && isValidRedirectUrl(redirectUrl) ? redirectUrl : "/dashboard";
      throw redirect(targetUrl, RedirectType.replace);
    }
  }, [user, isAuthenticated, searchParams]);

  return children;
}
