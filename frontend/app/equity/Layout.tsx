import React from "react";
import MainLayout from "@/components/layouts/Main";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { navLinks } from "./index";
import { useCurrentUser } from "@/global";

const Layout = ({ children, headerActions }: { children: React.ReactNode; headerActions?: React.ReactNode }) => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = user.companies.find((c) => c.id === user.currentCompanyId);
  const links = company ? navLinks(user, company) : [];
  const currentLink = links.find((link) => link.route === pathname);

  const title = (
    <div className="flex items-center gap-2">
      <span className="text-gray-500">Equity</span>
      <ChevronRight className="h-4 w-4 text-gray-500" />
      <span>{currentLink?.label}</span>
    </div>
  );

  return (
    <MainLayout title={title} headerActions={headerActions}>
      {children}
    </MainLayout>
  );
};

export default Layout;
