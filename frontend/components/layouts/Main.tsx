import { SignOutButton } from "@clerk/nextjs";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { skipToken, useQueryClient } from "@tanstack/react-query";
import {
  ChartPie,
  ChevronRight,
  ChevronsUpDown,
  Files,
  LogOut,
  ReceiptIcon,
  Settings,
  Users,
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";
import type { ReactNode } from "react";
import React from "react";
import { navLinks as equityNavLinks } from "@/app/equity";
import { useIsActionable } from "@/app/invoices";
import { GettingStarted } from "@/components/GettingStarted";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { storageKeys } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

// Custom logout component that handles both OTP and Clerk logout
const LogoutButton = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const { logout } = useUserStore();

  const handleLogout = async () => {
    // Prioritize OTP logout
    if (session?.user) {
      await signOut({ redirect: false });
    }
    // Clear user state
    logout();
    // Redirect to login
    window.location.href = "/login";
  };

  const isOtpUser = !!session?.user;

  if (isOtpUser) {
    return (
      <button onClick={handleLogout} className="w-full">
        {children}
      </button>
    );
  }

  // Fallback to Clerk logout for users who might still be signed in via Clerk
  return <SignOutButton>{children}</SignOutButton>;
};

const NavLinks = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const pathname = usePathname();

  // Use a simple invoices query that exists
  const { data: invoicesData } = trpc.invoices.list.useQuery(
    user.currentCompanyId && user.roles.administrator
      ? { companyId: user.currentCompanyId, status: ["received", "approved", "failed"] }
      : skipToken,
    { refetchInterval: 30_000 },
  );

  const isInvoiceActionable = useIsActionable();
  const actionableInvoices = invoicesData?.filter(isInvoiceActionable).length || 0;

  const companyNavLinks = useMemo(() => {
    const links: Array<{
      name: string;
      route: Route;
      icon: React.ElementType;
      badge?: ReactNode;
      children?: Array<{ name: string; route: Route }>;
    }> = [];

    if (user.roles.administrator || user.roles.worker) {
      links.push({
        name: "Invoices",
        route: "/invoices" as Route,
        icon: ReceiptIcon,
        badge: actionableInvoices > 0 ? (
          <Badge variant="destructive" className="h-auto px-1 py-0.5 text-xs leading-none">
            {actionableInvoices}
          </Badge>
        ) : undefined,
      });
    }

    if (user.roles.lawyer) {
      links.push({
        name: "Documents",
        route: "/documents" as Route,
        icon: Files,
      });
    }

    if (user.roles.administrator) {
      links.push({
        name: "People",
        route: "/people" as Route,
        icon: Users,
      });
    }

    if (user.currentCompanyId) {
      const equityLinks = equityNavLinks(user, company);
      if (equityLinks.length > 0) {
        links.push({
          name: "Equity",
          route: "/equity" as Route,
          icon: ChartPie,
          children: equityLinks.map((link) => ({
            name: link.label,
            route: link.route,
          })),
        });
      }
    }

    if (user.roles.administrator) {
      links.push({
        name: "Settings",
        route: "/settings" as Route,
        icon: Settings,
        children: [
          { name: "General", route: "/settings" as Route },
          { name: "Equity", route: "/settings/equity" as Route },
          { name: "Tax", route: "/settings/tax" as Route },
        ],
      });
    }

    return links;
  }, [user, company, actionableInvoices]);

  return (
    <SidebarMenu>
      {companyNavLinks.map((link) =>
        link.children ? (
          <Collapsible
            key={link.name}
            asChild
            open={link.children.some((child) => pathname.startsWith(child.route))}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <link.icon className="size-5" />
                  <span>{link.name}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {link.children.map((child) => (
                    <SidebarMenuSubItem key={child.name}>
                      <SidebarMenuSubButton asChild isActive={pathname.startsWith(child.route)}>
                        <Link href={child.route}>
                          <span>{child.name}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ) : (
          <SidebarMenuItem key={link.name}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(link.route)}>
              <Link href={link.route}>
                <link.icon className="size-5" />
                <span>{link.name}</span>
                {link.badge}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ),
      )}
    </SidebarMenu>
  );
};

export default function MainLayout({
  children,
  title,
  subtitle,
  headerActions,
  subheader,
  footer,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  subheader?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const user = useCurrentUser();

  const queryClient = useQueryClient();
  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    await request({
      method: "POST",
      url: company_switch_path(companyId),
      accept: "json",
    });
    await queryClient.resetQueries({ queryKey: ["currentUser"] });
    useUserStore.setState((state) => ({ ...state, pending: false }));
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Image src={defaultCompanyLogo} className="size-6" alt="" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.companies.find(c => c.id === user.currentCompanyId)?.name ?? "Personal"}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  {user.companies.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => switchCompany(company.id)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <Image src={defaultCompanyLogo} className="size-4 shrink-0" alt="" />
                      </div>
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {user.currentCompanyId ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <NavLinks />
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}

          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <LogoutButton>
                    <SidebarMenuButton className="cursor-pointer">
                      <LogOut className="size-6" />
                      <span>Log out</span>
                    </SidebarMenuButton>
                  </LogoutButton>
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
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            {title && (
              <>
                <div className="h-4 border-l border-gray-300" />
                <div>
                  <h1 className="font-semibold">{title}</h1>
                  {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              </>
            )}
          </div>
          {headerActions && <div className="ml-auto px-4">{headerActions}</div>}
        </header>
        {subheader && <div className="border-b border-sidebar-border px-4 py-2">{subheader}</div>}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="h-4" />
          {children}
          {footer}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
