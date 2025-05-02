import React from "react";
import MainLayout from "@/components/layouts/Main";
import Tabs from "@/components/Tabs";
import { useCurrentUser } from "@/global";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const user = useCurrentUser();

  const links = [
    { label: "Settings", route: "/settings", isVisible: true },
    { label: "Payouts", route: "/settings/payouts", isVisible: user.roles.worker || user.roles.investor },
    { label: "Tax info", route: "/settings/tax", isVisible: user.roles.worker || user.roles.investor },
  ] as const;

  const visibleLinks = links.filter((link) => link.isVisible);

  return (
    <MainLayout title="Profile">
      {visibleLinks.length > 1 && <Tabs links={visibleLinks} />}
      {children}
    </MainLayout>
  );
};

export default SettingsLayout;
