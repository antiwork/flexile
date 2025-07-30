"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { skipToken } from "@tanstack/react-query";
import { ChevronRight, LogOut, Sparkles, X } from "lucide-react";
import type { Route } from "next";
import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useIsActionable } from "@/app/(dashboard)/invoices";
import CompanySwitcher from "@/components/CompanySwitcher";
import { GettingStarted } from "@/components/GettingStarted";
import TabBar from "@/components/TabBar";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { getNavMain, type NavType } from "@/lib/navigation";
import { trpc } from "@/trpc/client";
import { useIsMobile } from "@/utils/use-mobile";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const user = useCurrentUser();
  const pathname = usePathname();
  const company = useCurrentCompany();
  const router = useRouter();
  const [showTryEquity, setShowTryEquity] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);
  const canShowTryEquity = user.roles.administrator && !company.equityEnabled;

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    user.currentCompanyId && user.roles.administrator
      ? { companyId: user.currentCompanyId, status: ["received", "approved", "failed"] }
      : skipToken,
    { refetchInterval: 30_000 },
  );
  const isInvoiceActionable = useIsActionable();
  const { data: documentsData } = trpc.documents.list.useQuery(
    user.currentCompanyId && user.id
      ? {
          companyId: user.currentCompanyId,
          userId: user.roles.administrator || user.roles.lawyer ? null : user.id,
          signable: true,
        }
      : skipToken,
    { refetchInterval: 30_000 },
  );
  const otherInfo = {
    badge: { invoices: invoicesData?.filter(isInvoiceActionable).length || 0, documents: documentsData?.length || 0 },
  };
  const navMain = getNavMain(user, company, pathname, otherInfo);

  return isMobile ? (
    <>
      <TabBar nav={navMain} type="main" />
      <div className="pb-18">
        <Main>{children}</Main>
      </div>
    </>
  ) : (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="[&_button]:hover:text-accent-foreground [&_button]:hover:hover:bg-gray-100/30">
          <CompanySwitcher />
        </SidebarHeader>
        <SidebarContent>
          {user.currentCompanyId ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navMain.map((item) =>
                    item.children ? (
                      <CollapsibleNav nav={item} key={item.label} />
                    ) : (
                      <NavItem
                        key={item.label}
                        href={item.route}
                        icon={item.icon}
                        active={item.isActive}
                        badge={item.badge}
                      >
                        {item.label}
                      </NavItem>
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}

          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {canShowTryEquity && showTryEquity ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <div
                        className="group relative flex cursor-pointer items-center justify-between"
                        onClick={() => router.push("/settings/administrator/equity")}
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="size-6" />
                          <span>Try equity</span>
                        </span>
                        {hovered ? (
                          <button
                            type="button"
                            aria-label="Dismiss try equity"
                            className="hover:bg-muted absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTryEquity(false);
                            }}
                            tabIndex={0}
                          >
                            <X className="text-muted-foreground hover:text-foreground size-4 transition-colors" />
                          </button>
                        ) : null}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
                <SidebarMenuItem>
                  <SignOutButton>
                    <SidebarMenuButton className="cursor-pointer">
                      <LogOut className="size-6" />
                      <span>Log out</span>
                    </SidebarMenuButton>
                  </SignOutButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {user.currentCompanyId && (user.roles.administrator || user.roles.worker) ? (
          <SidebarGroup className="mt-auto px-0 py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <GettingStarted />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </Sidebar>
      <SidebarInset>
        <Main>{children}</Main>
      </SidebarInset>
    </SidebarProvider>
  );
}

const NavItem = <T extends string>({
  icon,
  filledIcon,
  children,
  className,
  href,
  active,
  badge,
}: {
  children: React.ReactNode;
  className?: string;
  href: Route<T>;
  active?: boolean;
  icon: React.ComponentType;
  filledIcon?: React.ComponentType;
  badge?: number | undefined;
}) => {
  const Icon = active && filledIcon ? filledIcon : icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active ?? false} className={className}>
        <NavLink href={href}>
          <Icon />
          <span>{children}</span>
          {badge && badge > 0 ? (
            <Badge role="status" className="ml-auto h-4 w-auto min-w-4 bg-blue-500 px-1 text-xs text-white">
              {badge > 10 ? "10+" : badge}
            </Badge>
          ) : null}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const NavLink = <T extends string>(props: LinkProps<T>) => {
  const sidebar = useSidebar();
  return <Link onClick={() => sidebar.setOpenMobile(false)} {...props} />;
};

const CollapsibleNav = ({ nav }: { nav: NavType }) => {
  const storageKey = `${nav.label.toLowerCase().split(" ").join("-")}-menu-state`;
  const [isOpen, setIsOpen] = React.useState(() => localStorage.getItem(storageKey) === "open");
  const Icon = nav.icon;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(state) => {
        setIsOpen(state);
        localStorage.setItem(storageKey, state ? "open" : "closed");
      }}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <Icon />
            <span>{nav.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {nav.children?.map((item) => (
              <SidebarMenuSubItem key={item.route}>
                <SidebarMenuSubButton asChild isActive={item.isActive}>
                  <NavLink href={item.route}>{item.label}</NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
};

const Main = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col not-print:h-screen not-print:overflow-hidden">
    <main className="flex flex-1 flex-col pb-4 not-print:overflow-y-auto">
      <div className="mx-3 flex flex-col gap-6">{children}</div>
    </main>
  </div>
);
