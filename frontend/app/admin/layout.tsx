"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import {
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/global";
import { UserDataProvider } from "@/trpc/client";

function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();

  if (!user.teamMember) {
    router.replace("/dashboard");
    return null;
  }

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
        </Sidebar>
        <SidebarInset>
          <div className="flex items-center gap-2 p-2 md:hidden">
            <SidebarTrigger />
            <Link href="/dashboard" className="flex items-center gap-2 text-sm">
              <ChevronLeft className="h-4 w-4" />
              <span className="font-medium">Back to app</span>
            </Link>
          </div>
          <main className="mx-auto w-full max-w-3xl flex-1 p-6 pb-32 md:p-16">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserDataProvider>
      <AdminLayout>{children}</AdminLayout>
    </UserDataProvider>
  );
}
