"use client";
import { redirect, RedirectType } from "next/navigation";
import React, { useEffect } from "react";
import { useUserStore } from "@/global";
import SimpleLayout from "@/app/components/simple-layout";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useUserStore((state) => state.user);
  useEffect(() => {
    if (user) throw redirect("/dashboard", RedirectType.replace);
  }, []);
  return <SimpleLayout>{children}</SimpleLayout>;
}
