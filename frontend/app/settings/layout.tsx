"use client";

import {
  Briefcase,
  Building,
  ChevronLeft,
  CreditCard,
  Landmark,
  PieChart,
  ScrollText,
  ShieldUser,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/global";
import type { CurrentUser } from "@/models/user";

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
    route: "/settings/administrator" as const,
    icon: Building,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Workspace admins",
    route: "/settings/administrator/admins" as const,
    icon: ShieldUser,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Company details",
    route: "/settings/administrator/details" as const,
    icon: Briefcase,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Billing",
    route: "/settings/administrator/billing" as const,
    icon: CreditCard,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Equity value",
    route: "/settings/administrator/equity" as const,
    icon: PieChart,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
];
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
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
}
