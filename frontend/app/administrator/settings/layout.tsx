"use client";

import MainLayout from "@/components/layouts/Main";
import Tabs, { type TabLink } from "@/components/Tabs";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const links: TabLink[] = [
    { label: "Company settings", route: "/administrator/settings" },
    { label: "Billing", route: "/administrator/settings/billing" },
    { label: "Company details", route: "/administrator/settings/details" },
    { label: "Equity", route: "/administrator/settings/equity" },
  ];

  return (
    <MainLayout title="Company account">
      <Tabs links={links} />
      {children}
    </MainLayout>
  );
};

export default SettingsLayout;
