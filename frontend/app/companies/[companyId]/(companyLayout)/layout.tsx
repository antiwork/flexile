import React from "react";
import MainLayout from "@/components/layouts/Main";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
