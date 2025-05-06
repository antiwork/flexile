import { SignOutButton } from "@clerk/nextjs";
import {
  ArrowRightStartOnRectangleIcon,
  BriefcaseIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  BriefcaseIcon as SolidBriefcaseIcon,
  ChartPieIcon as SolidChartPieIcon,
  Cog6ToothIcon as SolidCog6ToothIcon,
  CurrencyDollarIcon as SolidCurrencyDollarIcon,
  DocumentDuplicateIcon as SolidDocumentDuplicateIcon,
  DocumentTextIcon as SolidDocumentTextIcon,
  MegaphoneIcon as SolidMegaphoneIcon,
  UserIcon as SolidUserIcon,
  UsersIcon as SolidUsersIcon,
} from "@heroicons/react/24/solid";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { navLinks as equityNavLinks } from "@/app/equity";
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
import { Separator } from "@/components/ui/separator";

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
                  <NavLink
                    href="/company_invitations"
                    icon={BriefcaseIcon}
                    filledIcon={SolidBriefcaseIcon}
                    active={pathname.startsWith("/company_invitations")}
                  >
                    Invite companies
                  </NavLink>
                )}
                <NavLink
                  href="/settings"
                  icon={UserIcon}
                  filledIcon={SolidUserIcon}
                  active={pathname.startsWith("/settings")}
                >
                  Account
                </NavLink>
                <SidebarMenuItem>
                  <SignOutButton>
                    <SidebarMenuButton className="cursor-pointer">
                      <ArrowRightStartOnRectangleIcon className="size-6" />
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
          <main className="flex flex-1 flex-col gap-6 pb-24 not-print:overflow-y-auto">
            <div>
              <header className="px-3 py-6 md:px-16">
                <div className="grid max-w-(--breakpoint-xl) gap-y-8">
                  <div className="grid items-center justify-between gap-3 md:flex">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <SidebarTrigger className="md:hidden" />
                        <h1 className="text-3xl/[2.75rem] font-bold">{title}</h1>
                      </div>
                      {subtitle}
                    </div>
                    {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
                  </div>
                </div>
              </header>
              <Separator className="my-0" />
              {subheader ? <div className="bg-gray-200/50">{subheader}</div> : null}
            </div>
            <div className="mx-3 flex max-w-(--breakpoint-xl) flex-col gap-6 md:mx-16">{children}</div>
          </main>
          {footer ? <div className="mt-auto">{footer}</div> : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const CompanyName = ({ company }: { company: Company }) => (
  <>
    <div className="relative size-8">
      <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-xs" alt="" />
    </div>
    <div>
      <span className="line-clamp-1 font-bold" title={company.name ?? ""}>
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
  const equityNavLink = equityNavLinks(user, company)[0];

  return (
    <SidebarMenu>
      {updatesPath ? (
        <NavLink
          href="/updates/company"
          icon={MegaphoneIcon}
          filledIcon={SolidMegaphoneIcon}
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
          icon={CurrencyDollarIcon}
          filledIcon={SolidCurrencyDollarIcon}
          active={!!active && pathname.startsWith(`/companies/${company.id}/expenses`)}
        >
          Expenses
        </NavLink>
      )}
      {routes.has("Documents") && (
        <NavLink
          href="/documents"
          icon={DocumentDuplicateIcon}
          filledIcon={SolidDocumentDuplicateIcon}
          active={!!active && (pathname.startsWith("/documents") || pathname.startsWith("/document_templates"))}
        >
          Documents
        </NavLink>
      )}
      {routes.has("People") && (
        <NavLink
          href="/people"
          icon={UsersIcon}
          filledIcon={SolidUsersIcon}
          active={!!active && (pathname.startsWith("/people") || pathname.includes("/investor_entities/"))}
        >
          People
        </NavLink>
      )}
      {routes.has("Roles") && (
        <NavLink
          href="/roles"
          icon={BriefcaseIcon}
          filledIcon={SolidBriefcaseIcon}
          active={!!active && pathname.startsWith("/roles")}
        >
          Roles
        </NavLink>
      )}
      {routes.has("Equity") && equityNavLink ? (
        <NavLink
          href={equityNavLink.route}
          icon={ChartPieIcon}
          filledIcon={SolidChartPieIcon}
          active={!!active && (pathname.startsWith("/equity") || pathname.includes("/equity_grants"))}
        >
          Equity
        </NavLink>
      ) : null}
      {routes.has("Settings") && (
        <NavLink
          href={user.roles.administrator ? `/administrator/settings` : `/settings`}
          active={!!active && (pathname.startsWith("/administrator/settings") || pathname.startsWith("/settings"))}
          icon={Cog6ToothIcon}
          filledIcon={SolidCog6ToothIcon}
        >
          Settings
        </NavLink>
      )}
    </SidebarMenu>
  );
};

const NavLink = ({
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
  href: string; // TODO use Route<T> here once all of them are migrated
  active?: boolean;
  icon: React.ComponentType;
  filledIcon?: React.ComponentType;
  badge?: number | undefined;
}) => {
  const Icon = active && filledIcon ? filledIcon : icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active ?? false} className={className}>
        <Link
          // @ts-expect-error see the above comment
          href={href}
        >
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

  return (
    <NavLink
      href="/invoices"
      icon={DocumentTextIcon}
      filledIcon={SolidDocumentTextIcon}
      active={active}
      badge={data?.length}
    >
      Invoices
    </NavLink>
  );
}
