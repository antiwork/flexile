import { usePathname } from "next/navigation";
import React from "react";
import MainLayout from "@/components/layouts/Main";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { navLinks } from ".";

const Layout = ({
  children,
  headerActions,
  pageTitle,
  footer,
}: {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  pageTitle?: React.ReactNode | string | null;
  footer?: React.ReactNode;
}) => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const currentLink =
    navLinks(user, company).find((link) => link.route === pathname) ||
    navLinks(user, company).find((link) => pathname.startsWith(link.route));

  const crumbs: React.ReactNode[] = ["Equity"];

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
    <MainLayout title={title} headerActions={headerActions} footer={footer}>
      {children}
    </MainLayout>
  );
};

export default Layout;
