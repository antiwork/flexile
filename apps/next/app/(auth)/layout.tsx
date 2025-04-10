"use client";
import { redirect, RedirectType } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  useEffect(() => {
    if (user) throw redirect("/dashboard", RedirectType.replace);
  }, []);
  return children;
}
