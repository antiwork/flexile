"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import TabBar from "@/components/TabBar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/global";
import { getNavSettings } from "@/lib/navigation";
import { useIsMobile } from "@/utils/use-mobile";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const navSettings = getNavSettings(user, pathname);

  return isMobile ? (
    <>
      <TabBar nav={navSettings} type="settings" />
      <Main>{children}</Main>
    </>
  ) : (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="offcanvas">
          <SidebarContent>
            {navSettings.map((item) =>
              item.children ? (
                <SidebarGroup key={item.label}>
                  <SidebarGroupLabel>{item.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {item.children.map((link) => (
                        <SidebarMenuItem key={link.route}>
                          <SidebarMenuButton asChild isActive={link.isActive}>
                            <Link href={link.route} className="flex items-center gap-3">
                              {link.icon ? <link.icon className="h-5 w-5" /> : null}
                              <span>{link.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : (
                <SidebarGroup key={item.label}>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={item.isActive}>
                          <Link href={item.route} className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ),
            )}
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <Main>{children}</Main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

const Main = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-16">{children}</main>
);
