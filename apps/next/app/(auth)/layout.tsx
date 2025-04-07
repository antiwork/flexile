"use client";
import { redirect, RedirectType } from "next/navigation";
import { useUserStore } from "@/global";
import React, { useEffect } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  useEffect(() => {
    if (user) throw redirect("/dashboard", RedirectType.replace);
  }, []);
  return children;
}
