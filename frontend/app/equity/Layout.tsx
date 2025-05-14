import React from "react";
import MainLayout from "@/components/layouts/Main";
import Tabs from "@/components/Tabs";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { navLinks } from ".";

const Layout = ({ children, headerActions }: { children: React.ReactNode; headerActions?: React.ReactNode }) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();

  return (
    <MainLayout title="Equity" headerActions={headerActions}>
      <Tabs links={navLinks(user, company)} />
      {children}
    </MainLayout>
  );
};

export default Layout;
