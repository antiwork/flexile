import { SignOutButton } from "@clerk/nextjs";
import {
  Rss,
  ChevronsUpDown,
  ReceiptIcon,
  Files,
  Users,
  BookUser,
  Settings,
  ChartPie,
  CircleDollarSign,
  LogOut,
  BriefcaseBusiness,
  ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
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
import { useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import logo from "@/images/flexile-logo.svg";
import { type Company } from "@/models/user";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";
import type { Route } from "next";
import { useIsActionable } from "@/app/invoices";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { navLinks as equityNavLinks } from "@/app/equity";

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

  const [openCompanyId, setOpenCompanyId] = useState(user.currentCompanyId);
  useEffect(() => setOpenCompanyId(user.currentCompanyId), [user.currentCompanyId]);
  const openCompany = user.companies.find((company) => company.id === openCompanyId);
  const pathname = usePathname();

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
        <SidebarHeader>
          {user.companies.length > 1 && openCompany ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="text-base" aria-label="Switch company">
                      <CompanyName company={openCompany} />
                      <ChevronsUpDown className="ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(radix-dropdown-menu-trigger-width)" align="start">
                    {user.companies.map((company) => (
                      <DropdownMenuItem
                        key={company.id}
                        onSelect={() => {
                          if (user.currentCompanyId !== company.id) void switchCompany(company.id);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Image
                          src={company.logo_url || defaultCompanyLogo}
                          width={20}
                          height={20}
                          className="rounded-xs"
                          alt=""
                        />
                        <span className="line-clamp-1">{company.name}</span>
                        {company.id === user.currentCompanyId && (
                          <div className="ml-auto size-2 rounded-full bg-blue-500"></div>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : openCompany ? (
            <div className="flex items-center gap-2 p-2">
              <CompanyName company={openCompany} />
            </div>
          ) : (
            <Image src={logo} alt="Flexile" />
          )}
        </SidebarHeader>
        <SidebarContent>
          {openCompany ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <NavLinks company={openCompany} />
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}

          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {!user.companies.length && (
                  <>
                    <NavLink href="/settings" icon={Settings} active={pathname.startsWith("/settings")}>
                      Settings
                    </NavLink>
                    <NavLink
                      href="/company_invitations/new"
                      icon={BriefcaseBusiness}
                      active={pathname.startsWith("/company_invitations")}
                    >
                      Invite companies
                    </NavLink>
                  </>
                )}
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
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col not-print:h-screen not-print:overflow-hidden">
          <main className="flex flex-1 flex-col pb-4 not-print:overflow-y-auto">
            <div>
              <header className="px-3 py-2 md:px-4 md:py-4">
                <div className="grid gap-y-8">
                  <div className="grid items-center justify-between gap-3 md:flex">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <SidebarTrigger className="md:hidden" />
                        <h1 className="text-sm font-bold">{title}</h1>
                      </div>
                      {subtitle}
                    </div>
                    {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
                  </div>
                </div>
              </header>
              {subheader ? <div className="bg-gray-200/50">{subheader}</div> : null}
            </div>
            <div className="mx-3 flex flex-col gap-6">{children}</div>
          </main>
          {footer ? <div className="mt-auto">{footer}</div> : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const CompanyName = ({ company }: { company: Company }) => (
  <>
    <div className="relative size-6">
      <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm" alt="" />
    </div>
    <div>
      <span className="line-clamp-1 text-sm font-bold" title={company.name ?? ""}>
        {company.name}
      </span>
    </div>
  </>
);

const NavLinks = ({ company }: { company: Company }) => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const active = user.currentCompanyId === company.id;
  const routes = new Set(
    company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
  );
  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const equityLinks = equityNavLinks(user, company);

  const [isOpen, setIsOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("equity-menu-state");
    return stored === "open";
  });

  return (
    <SidebarMenu>
      {updatesPath ? (
        <NavLink
          href="/updates/company"
          icon={Rss}
          filledIcon={Rss}
          active={!!active && pathname.startsWith("/updates")}
        >
          Updates
        </NavLink>
      ) : null}
      {routes.has("Invoices") && (
        <InvoicesNavLink companyId={company.id} active={!!active && pathname.startsWith("/invoices")} />
      )}
      {routes.has("Expenses") && (
        <NavLink
          href={`/companies/${company.id}/expenses`}
          icon={CircleDollarSign}
          active={!!active && pathname.startsWith(`/companies/${company.id}/expenses`)}
        >
          Expenses
        </NavLink>
      )}
      {routes.has("Documents") && (
        <NavLink
          href="/documents"
          icon={Files}
          active={!!active && (pathname.startsWith("/documents") || pathname.startsWith("/document_templates"))}
        >
          Documents
        </NavLink>
      )}
      {routes.has("People") && (
        <NavLink
          href="/people"
          icon={Users}
          active={!!active && (pathname.startsWith("/people") || pathname.includes("/investor_entities/"))}
        >
          People
        </NavLink>
      )}
      {routes.has("Roles") && (
        <NavLink href="/roles" icon={BookUser} active={!!active && pathname.startsWith("/roles")}>
          Roles
        </NavLink>
      )}
      {routes.has("Equity") && equityLinks.length > 0 && (
        <Collapsible
          open={isOpen}
          onOpenChange={(state) => {
            setIsOpen(state);
            localStorage.setItem("equity-menu-state", state ? "open" : "closed");
          }}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <ChartPie />
                <span>Equity</span>
                <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {equityLinks.map((link) => (
                  <SidebarMenuSubItem key={link.route}>
                    <SidebarMenuSubButton asChild isActive={pathname === link.route}>
                      <Link href={link.route}>{link.label}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      )}
      {routes.has("Settings") && (
        <NavLink
          href="/settings"
          active={!!active && (pathname.startsWith("/administrator/settings") || pathname.startsWith("/settings"))}
          icon={Settings}
        >
          Settings
        </NavLink>
      )}
    </SidebarMenu>
  );
};

const NavLink = <T extends string>({
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
        <Link href={href}>
          <Icon />
          <span>{children}</span>
          {badge && badge > 0 ? (
            <Badge role="status" className="ml-auto h-4 w-auto min-w-4 bg-blue-500 px-1 text-xs text-white">
              {badge > 10 ? "10+" : badge}
            </Badge>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

function InvoicesNavLink({ companyId, active }: { companyId: string; active: boolean }) {
  const user = useCurrentUser();
  const { data } = trpc.invoices.list.useQuery(
    { companyId, status: ["received", "approved", "failed"] },
    { refetchInterval: 30_000, enabled: !!user.roles.administrator },
  );
  const isActionable = useIsActionable();

  return (
    <NavLink href="/invoices" icon={ReceiptIcon} active={active} badge={data?.filter(isActionable).length}>
      Invoices
    </NavLink>
  );
}
