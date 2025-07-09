"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserCircle2,
  Briefcase,
  CreditCard,
  PieChart,
  ChevronLeft,
  Landmark,
  ScrollText,
  Building,
} from "lucide-react";
import { useCurrentUser } from "@/global";
import type { CurrentUser } from "@/models/user";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const personalLinks = [
  {
    label: "Profile",
    route: "/settings" as const,
    icon: UserCircle2,
    isVisible: (_user: CurrentUser) => true,
  },
  {
    label: "Payouts",
    route: "/settings/payouts" as const,
    icon: Landmark,
    isVisible: (user: CurrentUser) => !!user.roles.worker || !!user.roles.investor,
  },
  {
    label: "Tax information",
    route: "/settings/tax" as const,
    icon: ScrollText,
    isVisible: (user: CurrentUser) => !!user.roles.worker || !!user.roles.investor,
  },
];

const companyLinks = [
  {
    label: "Workspace settings",
    route: "/administrator/settings" as const,
    icon: Building,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Company details",
    route: "/administrator/settings/details" as const,
    icon: Briefcase,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Billing",
    route: "/administrator/settings/billing" as const,
    icon: CreditCard,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Equity value",
    route: "/administrator/settings/equity" as const,
    icon: PieChart,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
];

const Settings = ({ children }: { children: React.ReactNode }) => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const filteredPersonalLinks = personalLinks.filter((link) => link.isVisible(user));
  const filteredCompanyLinks = companyLinks.filter((link) => link.isVisible(user));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="flex items-center gap-2 text-sm">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-muted-foreground font-medium">Back to app</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Personal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredPersonalLinks.map((link) => (
                    <SidebarMenuItem key={link.route}>
                      <SidebarMenuButton asChild isActive={pathname === link.route}>
                        <Link href={link.route} className="flex items-center gap-3">
                          <link.icon className="h-5 w-5" />
                          <span>{link.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {filteredCompanyLinks.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Company</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredCompanyLinks.map((link) => (
                      <SidebarMenuItem key={link.route}>
                        <SidebarMenuButton asChild isActive={pathname === link.route}>
                          <Link href={link.route} className="flex items-center gap-3">
                            <link.icon className="h-5 w-5" />
                            <span>{link.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex items-center gap-2 p-2 md:hidden">
            <SidebarTrigger />
            <Link href="/dashboard" className="flex items-center gap-2 text-sm">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-muted-foreground font-medium">Back to app</span>
            </Link>
          </div>
          <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-16">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
