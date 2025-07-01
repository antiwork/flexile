"use client";
import { redirect, RedirectType, useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (user) {
      const redirectUrl = searchParams.get("redirect_url");
      const targetUrl = redirectUrl || "/dashboard";
      throw redirect(targetUrl, RedirectType.replace);
    }
  }, [user, searchParams]);

  return children;
}
