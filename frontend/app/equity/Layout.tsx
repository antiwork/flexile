import React from "react";
import MainLayout from "@/components/layouts/Main";
import { usePathname } from "next/navigation";
import { navLinks } from ".";
import { useCurrentCompany, useCurrentUser } from "@/global";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const Layout = ({
  children,
  headerActions,
  pageTitle,
}: {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  pageTitle?: string;
}) => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const currentLink =
    navLinks(user, company).find((link) => link.route === pathname) ||
    navLinks(user, company).find((link) => pathname.startsWith(link.route));

  const crumbs = ["Equity"];

  if (currentLink) {
    crumbs.push(currentLink.label);
  }

  if (pageTitle) {
    crumbs.push(pageTitle);
  }

  const title = (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) =>
          index === crumbs.length - 1 ? (
            <BreadcrumbItem key={index}>
              <BreadcrumbPage>{crumb}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <React.Fragment key={index}>
              <BreadcrumbItem>{crumb}</BreadcrumbItem>
              <BreadcrumbSeparator />
            </React.Fragment>
          ),
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <MainLayout title={title} headerActions={headerActions}>
      {children}
    </MainLayout>
  );
};

export default Layout;
