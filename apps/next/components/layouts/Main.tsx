import { SignOutButton } from "@clerk/nextjs";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentCurrencyDollarIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  UserGroupIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ChevronsUpDown } from "lucide-react"

import {
  ArrowPathIcon,
  BriefcaseIcon as SolidBriefcaseIcon,
  BuildingOfficeIcon as SolidBuildingOfficeIcon,
  ChartPieIcon as SolidChartPieIcon,
  Cog6ToothIcon as SolidCog6ToothIcon,
  CurrencyDollarIcon as SolidCurrencyDollarIcon,
  DocumentDuplicateIcon as SolidDocumentDuplicateIcon,
  DocumentTextIcon as SolidDocumentTextIcon,
  MegaphoneIcon as SolidMegaphoneIcon,
  UserGroupIcon as SolidUserGroupIcon,
  UserIcon as SolidUserIcon,
  UsersIcon as SolidUsersIcon,
} from "@heroicons/react/24/solid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { capitalize } from "lodash-es";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";
import { navLinks as equityNavLinks } from "@/app/equity";
import InvoiceStatus, { invoiceSchema } from "@/app/invoices/LegacyStatus";
import Input from "@/components/Input";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import logo from "@/images/flexile-logo.svg";
import { type Company } from "@/models/user";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { assertDefined } from "@/utils/assert";
import { request } from "@/utils/request";
import { company_search_path, company_switch_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import { useOnGlobalEvent } from "@/utils/useOnGlobalEvent";
import "@/components/layouts/sidebar.css";

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
  useSidebar
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import type { Route } from "next";

type CompanyAccessRole = "administrator" | "worker" | "investor" | "lawyer";

const searchResultsSchema = z.object({
  invoices: z.array(invoiceSchema),
  users: z.array(z.object({ name: z.string(), role: z.string(), url: z.string() })),
});

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
  const isRole = (...roles: (typeof user.activeRole)[]) => roles.includes(user.activeRole);
  const [openCompanyId, setOpenCompanyId] = useState(user.currentCompanyId);
  useEffect(() => setOpenCompanyId(user.currentCompanyId), [user.currentCompanyId]);
  const openCompany = user.companies.find((company) => company.id === openCompanyId);
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 200);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  const uid = React.useId();

  const { data: searchResults } = useQuery({
    queryKey: ["search", debouncedQuery, user.currentCompanyId],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: company_search_path(assertDefined(user.currentCompanyId), { query: debouncedQuery }),
        accept: "json",
      });
      return searchResultsSchema.parse(await response.json());
    },
    enabled: debouncedQuery.length > 0 && !!user.currentCompanyId,
  });
  useEffect(() => setSelectedResultIndex(0), [searchResults]);

  useOnGlobalEvent("keydown", (event) => {
    if (
      document.activeElement instanceof HTMLElement &&
      (["INPUT", "TEXTAREA"].includes(document.activeElement.nodeName) || document.activeElement.isContentEditable)
    )
      return;
    if (event.key === "/") {
      event.preventDefault();
      searchInputRef.current?.focus();
    }
  });

  const cancelSearch = () => searchInputRef.current?.blur();

  const resetSearch = () => {
    cancelSearch();
    setQuery("");
  };

  const setSelectedCompany = async (companyId: string) => {
    if (user.currentCompanyId !== companyId) {
      await switchCompany(companyId);
    }
  }

  const switchCompany = useSwitchCompanyOrRole();


  return (
    <SidebarProvider>
      <Sidebar className="bg-black text-white" collapsible="offcanvas">
        <SidebarHeader className="bg-black text-white">
          <SidebarMenu>
            <SidebarMenuItem>
              {user.companies.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground py-4 text-base"
                    >
                      {openCompany ? (
                        <CompanyName company={openCompany} />
                      ) : (
                        <Image src={logo} className="invert" alt="Flexile" />
                      )}
                      <ChevronsUpDown className="ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width]"
                    align="start"
                  >
                    {user.companies.map((company) => (
                      <DropdownMenuItem
                        key={company.id}
                        onSelect={() => setSelectedCompany(company.id)}
                        className="flex items-center gap-2"
                      >
                        <div className="relative size-5">
                          <Image src={company.logo_url || defaultCompanyLogo} width={20} height={20} className="rounded-xs" alt="" />
                        </div>
                        <span className="line-clamp-1">{company.name}</span>
                        {company.id === user.currentCompanyId && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-blue-500"></div>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarMenuButton size="lg" className="py-4 text-base">
                  {openCompany ? (
                    <CompanyName company={openCompany} />
                  ) : (
                    <Image src={logo} className="invert" alt="Flexile" />
                  )}
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="bg-black text-white">
          {openCompany && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {openCompany.routes.some(route => route.label === "Updates") && (
                    <>
                      <SidebarNavItem
                        href="/updates"
                        icon={MegaphoneIcon}
                        activeIcon={SolidMegaphoneIcon}
                        isActive={pathname.startsWith("/updates")}
                        label="Updates"
                      />
                      {openCompany.routes.some(route => route.label === "Company") &&
                       openCompany.routes.some(route => route.label === "Team") && (
                        <>
                          <SidebarNavItem
                            href="/updates/company"
                            icon={BuildingOfficeIcon}
                            activeIcon={SolidBuildingOfficeIcon}
                            isActive={pathname.startsWith("/updates/company")}
                            label="Company"
                            className="ml-4"
                          />
                          <SidebarNavItem
                            href="/updates/team"
                            icon={UserGroupIcon}
                            activeIcon={SolidUserGroupIcon}
                            isActive={pathname.startsWith("/updates/team")}
                            label="Team"
                            className="ml-4"
                          />
                        </>
                      )}
                    </>
                  )}

                  {openCompany.routes.some(route => route.label === "Invoices") && (
                    <InvoicesNavItem companyId={openCompany.id} isActive={pathname.startsWith("/invoices")} isAdmin={isRole("administrator")} />
                  )}

                  {openCompany.routes.some(route => route.label === "Expenses") && (
                    <SidebarNavItem
                      href={`/companies/${openCompany.id}/expenses`}
                      icon={CurrencyDollarIcon}
                      activeIcon={SolidCurrencyDollarIcon}
                      isActive={pathname.startsWith(`/companies/${openCompany.id}/expenses`)}
                      label="Expenses"
                    />
                  )}

                  {openCompany.routes.some(route => route.label === "Documents") && (
                    <SidebarNavItem
                      href="/documents"
                      icon={DocumentDuplicateIcon}
                      activeIcon={SolidDocumentDuplicateIcon}
                      isActive={pathname.startsWith("/documents") || pathname.startsWith("/document_templates")}
                      label="Documents"
                    />
                  )}

                  {openCompany.routes.some(route => route.label === "People") && (
                    <SidebarNavItem
                      href="/people"
                      icon={UsersIcon}
                      activeIcon={SolidUsersIcon}
                      isActive={pathname.startsWith("/people") || pathname.includes("/investor_entities/")}
                      label="People"
                    />
                  )}

                  {openCompany.routes.some(route => route.label === "Roles") && (
                    <SidebarNavItem
                      href="/roles"
                      icon={BriefcaseIcon}
                      activeIcon={SolidBriefcaseIcon}
                      isActive={pathname.startsWith("/roles") || pathname.startsWith("/talent_pool") || pathname.startsWith("/role_applications")}
                      label="Roles"
                    />
                  )}

                  {openCompany.routes.some(route => route.label === "Equity") && equityNavLinks(user, openCompany)[0] && (
                    <SidebarNavItem
                      href={equityNavLinks(user, openCompany)[0]?.route ?? "#"}
                      icon={ChartPieIcon}
                      activeIcon={SolidChartPieIcon}
                      isActive={pathname.startsWith("/equity") || pathname.includes("/equity_grants")}
                      label="Equity"
                    />
                  )}

                  {openCompany.routes.some(route => route.label === "Settings") && (
                    <SidebarNavItem
                      href={isRole("administrator") ? `/administrator/settings` : `/settings/equity`}
                      icon={Cog6ToothIcon}
                      activeIcon={SolidCog6ToothIcon}
                      isActive={pathname.startsWith("/settings")}
                      label="Settings"
                    />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {openCompany && openCompany.other_access_roles && openCompany.other_access_roles.length > 0 && (
            <SidebarGroup className="mt-4">
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {openCompany.other_access_roles.map((accessRole) => (
                    <SidebarMenuItem key={accessRole}>
                      <SidebarMenuButton
                        onClick={() => switchCompany(openCompany.id, accessRole)}
                        className="py-3 text-base hover:font-bold hover:text-white cursor-pointer"
                      >
                        <ArrowPathIcon className="size-6 mr-3" />
                        <span>Use as {accessRole === "administrator" ? "admin" : accessRole}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {!user.companies.length && (
                    <SidebarNavItem
                    href="/company_invitations"
                    icon={UserIcon}
                    activeIcon={SolidUserIcon}
                    isActive={pathname.startsWith("/company_invitations")}
                    label="Invite companies" />
                )}
                <SidebarNavItem
                  href="/settings"
                  icon={UserIcon}
                  activeIcon={SolidUserIcon}
                  isActive={pathname.startsWith("/settings")}
                  label="Account"
                />
                {/* <SidebarMenuItem>
                  <SidebarMenuButton asChild className="py-3 text-base">
                    <Link href="/settings" className={pathname.startsWith("/settings") ? "font-bold text-white" : ""}>
                      <SolidUserIcon className="size-6 mr-3" />
                      <span>Account</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem> */}
                <SidebarMenuItem>
                  <SignOutButton>
                    <SidebarMenuButton className="py-3 text-base hover:font-bold hover:text-white cursor-pointer">
                      <ArrowRightStartOnRectangleIcon className="size-6 mr-3" />
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

        {/* Mobile Only Nav Header */}
        <nav
          className={cn("inset-0 z-10 bg-black text-gray-400 md:hidden print:hidden")}
          aria-label="Main Menu"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 px-4 py-3 font-bold text-white md:hidden">
              {openCompany ? (
                <CompanyName company={openCompany} />
              ) : (
                <Image src={logo} className="invert" alt="Flexile" />
              )}
            </div>
            <CustomSidebarTrigger />
          </div>
        </nav>
        <div className="flex flex-col not-print:h-screen not-print:overflow-hidden">
          <header className="flex items-center border-b bg-gray-200 px-3 pt-8 pb-4 md:px-16">
            <div className="grid max-w-(--breakpoint-xl) gap-y-8 w-full">
              {user.companies.length > 0 && (
                <search className="relative print:hidden">
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={setQuery}
                    className="rounded-full! border-0"
                    placeholder={isRole("administrator") ? "Search invoices, people..." : "Search invoices"}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      !!searchFocused &&
                      (searchResults?.invoices.length || 0) + (searchResults?.users.length || 0) > 0
                    }
                    prefix={<MagnifyingGlassIcon className="size-4" />}
                    aria-controls={`${uid}results`}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onKeyDown={(e) => {
                      switch (e.key) {
                        case "Enter":
                          if ((searchResults?.invoices.length || 0) > 0 || (searchResults?.users.length || 0) > 0) {
                            const links = searchResultsRef.current?.querySelectorAll("a");
                            links?.[selectedResultIndex]?.click();
                          }
                          break;
                        case "Escape":
                          cancelSearch();
                          break;
                        case "ArrowDown":
                          e.preventDefault();
                          setSelectedResultIndex((prev) =>
                            prev < (searchResults?.invoices.length || 0) + (searchResults?.users.length || 0) - 1
                              ? prev + 1
                              : prev,
                          );
                          break;
                        case "ArrowUp":
                          e.preventDefault();
                          setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : prev));
                          break;
                      }
                    }}
                  />

                  {searchResults &&
                  searchFocused &&
                  searchResults.invoices.length + searchResults.users.length > 0 ? (
                    <div
                      id={`${uid}results`}
                      ref={searchResultsRef}
                      role="listbox"
                      className="absolute inset-x-0 top-full z-10 mt-2 rounded-xl border bg-white"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <SearchLinks
                        links={searchResults.invoices}
                        selectedResultIndex={selectedResultIndex}
                        setSelectedResultIndex={setSelectedResultIndex}
                        onClick={resetSearch}
                        title="Invoices"
                        className="mt-2"
                      >
                        {(invoice) => (
                          <>
                            <DocumentCurrencyDollarIcon className="size-6" />
                            {invoice.title}
                            <div className="text-xs">&mdash; {formatDate(invoice.invoice_date)}</div>
                            <InvoiceStatus invoice={invoice} className="ml-auto text-xs" />
                          </>
                        )}
                      </SearchLinks>
                      <SearchLinks
                        links={searchResults.users}
                        selectedResultIndex={selectedResultIndex - searchResults.invoices.length}
                        setSelectedResultIndex={(i) => setSelectedResultIndex(searchResults.invoices.length + i)}
                        onClick={resetSearch}
                        title="People"
                        className="mt-2"
                      >
                        {(user) => (
                          <>
                            {user.name}
                            <div className="text-xs">&mdash; {user.role}</div>
                          </>
                        )}
                      </SearchLinks>
                      <footer className="rounded-b-xl border-t bg-gray-50 px-3 py-1 text-xs text-gray-400">
                        Pro tip: open search by pressing the
                        <kbd className="rounded-full border border-gray-300 bg-white px-2 py-0.5 font-mono text-sm">
                          /
                        </kbd>{" "}
                        key
                      </footer>
                    </div>
                  ) : null}
                </search>
              )}
              <div className="grid items-center justify-between gap-3 md:flex">
                <div>
                  <h1 className="text-3xl/[2.75rem] font-bold">{title}</h1>
                  {subtitle}
                </div>
                {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
              </div>
            </div>
          </header>
          {subheader ? <div className="border-b bg-gray-200/50">{subheader}</div> : null}
          <main className="flex flex-1 flex-col gap-6 pb-4 mt-6 not-print:overflow-y-auto">
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
      {company.selected_access_role && company.other_access_roles.length > 0 ? (
        <div className="text-xs">{capitalize(company.selected_access_role)}</div>
      ) : null}
    </div>
  </>
);

const useSwitchCompanyOrRole = () => {
  const queryClient = useQueryClient();
  return async (companyId: string, accessRole?: CompanyAccessRole) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    await request({
      method: "POST",
      url: company_switch_path(companyId, { access_role: accessRole }),
      accept: "json",
    });
    await queryClient.resetQueries({ queryKey: ["currentUser"] });
    useUserStore.setState((state) => ({ ...state, pending: false }));
  };
};

const SidebarNavItem = ({
  href,
  icon,
  activeIcon,
  isActive,
  label,
  className,
  badge
}: {
  href: string;
  icon: React.ElementType;
  activeIcon: React.ElementType;
  isActive: boolean;
  label: string;
  className?: string;
  badge?: number | undefined;
}) => {
  const Icon = isActive ? activeIcon : icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={cn("py-3 text-base [&>svg]:size-6 hover:font-bold hover:text-white", className)}>
        <Link href={href as Route} className={isActive ? "font-bold text-white" : ""}>
          <Icon className="mr-3" />
          <span>{label}</span>
          {badge && badge > 0 ? (
              <Badge
                role="status"
                className="h-4 w-auto min-w-4 px-1 text-xs bg-blue-500 text-white"
              >
                {badge > 10 ? "10+" : badge}
              </Badge>
            ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const SearchLinks = <T extends { url: string }>({
  links,
  selectedResultIndex,
  setSelectedResultIndex,
  onClick,
  children,
  title,
  className,
}: {
  links: T[];
  selectedResultIndex: number;
  setSelectedResultIndex: (index: number) => void;
  onClick: () => void;
  children: (link: T) => React.ReactNode;
  title: string;
  className?: string;
}) => (
  <div role="group" className={className}>
    <h4 className="mt-2 px-3 text-xs text-gray-400">{title}</h4>
    {links.map((link, i) => (
      <a
        key={link.url}
        href={link.url}
        className={cn("flex items-center gap-1 px-3 py-1", { "text-blue-600": i === selectedResultIndex })}
        role="option"
        onClick={onClick}
        onMouseOver={() => setSelectedResultIndex(i)}
      >
        {children(link)}
      </a>
    ))}
  </div>
);

const CustomSidebarTrigger = () => {
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();
  return (
    <> {isMobile && (
      <button
        onClick={() => setOpenMobile(!openMobile)}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
    >
      {openMobile ? (
        <XMarkIcon className="size-5" />
      ) : (
        <Bars3Icon className="size-5" />
      )}
    </button>)}
    </>
  );
};

const InvoicesNavItem = ({ companyId, isActive, isAdmin }: { companyId: string; isActive: boolean; isAdmin: boolean }) => {
  const { data, isLoading } = trpc.invoices.list.useQuery(
    {
      companyId,
      invoiceFilter: "actionable",
      perPage: 1,
      page: 1,
    },
    {
      refetchInterval: 30_000,
      enabled: isAdmin,
    },
  );

  return (
    <SidebarNavItem
      href="/invoices"
      icon={DocumentTextIcon}
      activeIcon={SolidDocumentTextIcon}
      isActive={isActive}
      label="Invoices"
      badge={isAdmin && !isLoading ? data?.total : undefined}
    />
  );
}