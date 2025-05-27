"use client";

import React from "react";
import MainLayout from "@/app/components/main-layout";
import Tabs from "@/components/Tabs";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { navLinks } from ".";

export default function EquityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const company = useCurrentCompany();

  return (
    <MainLayout title="Equity">
      <Tabs links={navLinks(user, company)} />
      {children}
    </MainLayout>
  );
}
