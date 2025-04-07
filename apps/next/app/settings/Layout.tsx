import MainLayout from "@/components/layouts/Main";
import Tabs from "@/components/Tabs";
import { useCurrentUser } from "@/global";
import React from "react";

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  const user = useCurrentUser();
  const company = user.companies.find((c) => c.id === user.currentCompanyId);

  const links = [
    { label: "Settings", route: "/settings", isVisible: true },
    { label: "Payouts", route: "/settings/payouts", isVisible: user.activeRole === "contractorOrInvestor" },
    { label: "Tax info", route: "/settings/tax", isVisible: user.activeRole === "contractorOrInvestor" },
    {
      label: "Equity",
      route: "/settings/equity",
      isVisible:
        user.roles.worker &&
        user.roles.worker.payRateType !== "salary" &&
        user.activeRole === "contractorOrInvestor" &&
        company?.flags.includes("equity_compensation"),
    },
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
