"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
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
import { settingsNavLinks } from "@/lib/settingsNavLinks";
import { UserDataProvider } from "@/trpc/client";

function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const filteredPersonalLinks = settingsNavLinks.filter((link) => link.category === "personal" && link.isVisible(user));
  const filteredCompanyLinks = settingsNavLinks.filter((link) => link.category === "company" && link.isVisible(user));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="offcanvas" mobileSidebar={<MobileBottomNav />}>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="flex items-center gap-2 text-sm">
                    <ChevronLeft className="h-4 w-4" />
                    <span className="font-medium">Back to app</span>
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
              <span className="font-medium">Back to app</span>
            </Link>
          </div>
          <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-16">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserDataProvider>
      <SettingsLayout>{children}</SettingsLayout>
    </UserDataProvider>
  );
}
