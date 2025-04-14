import { SignOutButton } from "@clerk/nextjs";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChartPieIcon,
  ChevronDownIcon,
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
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import { linkClasses } from "@/components/Link";
import { useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import logo from "@/images/flexile-logo.svg";
import { type Company } from "@/models/user";
import { trpc } from "@/trpc/client";
import { cn, e } from "@/utils";
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
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

type CompanyAccessRole = "administrator" | "worker" | "investor" | "lawyer";

const searchResultsSchema = z.object({
  invoices: z.array(invoiceSchema),
  users: z.array(z.object({ name: z.string(), role: z.string(), url: z.string() })),
});

const navItemClasses = "flex items-center gap-3 px-4 py-3";
const navLinkClasses = "flex items-center gap-3 px-4 py-3 no-underline hover:font-bold hover:text-white cursor-pointer";

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
  const [navOpen, setNavOpen] = useState(false);
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

  const toggleButton = (
    <button
      className={cn(linkClasses, "ml-auto md:hidden")}
      aria-label="Toggle Main Menu"
      aria-expanded={navOpen}
      onClick={() => setNavOpen(!navOpen)}
    >
      {navOpen ? <XMarkIcon className="size-6" /> : <Bars3Icon className="size-6" />}
    </button>
  );

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar className="bg-black text-white">
        <SidebarHeader>
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
        <SidebarContent>
          {openCompany && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {openCompany.routes.some(route => route.label === "Updates") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base">
                        <Link href="/updates" className={pathname.startsWith("/updates") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/updates") ? (
                            <SolidMegaphoneIcon className="size-6 mr-3" />
                          ) : (
                            <MegaphoneIcon className="size-6 mr-3" />
                          )}
                          <span>Updates</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Invoices") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href="/invoices" className={pathname.startsWith("/invoices") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/invoices") ? (
                            <SolidDocumentTextIcon className="mr-3" />
                          ) : (
                            <DocumentTextIcon className="mr-3" />
                          )}
                          <span>Invoices</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Expenses") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href={`/companies/${openCompany.id}/expenses`} className={pathname.startsWith(`/companies/${openCompany.id}/expenses`) ? "font-bold text-white" : ""}>
                          {pathname.startsWith(`/companies/${openCompany.id}/expenses`) ? (
                            <SolidCurrencyDollarIcon className="mr-3" />
                          ) : (
                            <CurrencyDollarIcon className="mr-3" />
                          )}
                          <span>Expenses</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Documents") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href="/documents" className={pathname.startsWith("/documents") || pathname.startsWith("/document_templates") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/documents") || pathname.startsWith("/document_templates") ? (
                            <SolidDocumentDuplicateIcon className="mr-3" />
                          ) : (
                            <DocumentDuplicateIcon className="mr-3" />
                          )}
                          <span>Documents</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "People") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href="/people" className={pathname.startsWith("/people") || pathname.includes("/investor_entities/") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/people") || pathname.includes("/investor_entities/") ? (
                            <SolidUsersIcon className="mr-3" />
                          ) : (
                            <UsersIcon className="mr-3" />
                          )}
                          <span>People</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Roles") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href="/roles" className={pathname.startsWith("/roles") || pathname.startsWith("/talent_pool") || pathname.startsWith("/role_applications") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/roles") || pathname.startsWith("/talent_pool") || pathname.startsWith("/role_applications") ? (
                            <SolidBriefcaseIcon className="mr-3" />
                          ) : (
                            <BriefcaseIcon className="mr-3" />
                          )}
                          <span>Roles</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Equity") && equityNavLinks(user, openCompany)[0] && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href={equityNavLinks(user, openCompany)[0]?.route ?? "#"} className={pathname.startsWith("/equity") || pathname.includes("/equity_grants") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/equity") || pathname.includes("/equity_grants") ? (
                            <SolidChartPieIcon className="mr-3" />
                          ) : (
                            <ChartPieIcon className="mr-3" />
                          )}
                          <span>Equity</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {openCompany.routes.some(route => route.label === "Settings") && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="py-3 text-base [&>svg]:size-6">
                        <Link href={isRole("administrator") ? `/administrator/settings` : `/settings/equity`} className={pathname.startsWith("/settings") ? "font-bold text-white" : ""}>
                          {pathname.startsWith("/settings") ? (
                            <SolidCog6ToothIcon className="mr-3" />
                          ) : (
                            <Cog6ToothIcon className="mr-3" />
                          )}
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
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
                        className="py-3 text-base"
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="py-3 text-base">
                      <Link href="/company_invitations" className={pathname.startsWith("/company_invitations") ? "font-bold text-white" : ""}>
                        <SolidBriefcaseIcon className="size-6 mr-3" />
                        <span>Invite companies</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="py-3 text-base">
                    <Link href="/settings" className={pathname.startsWith("/settings") ? "font-bold text-white" : ""}>
                      <SolidUserIcon className="size-6 mr-3" />
                      <span>Account</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SignOutButton>
                    <SidebarMenuButton className="py-3 text-base">
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
        <div className={cn("grid md:grid-cols-[14rem_1fr]" /* { "h-full": appConfig.is_demo_mode } */)}>

        {/* TODO remove <nav></nav> once fully migrated */}
          <nav
            className={cn("inset-0 z-10 bg-black text-gray-400 md:static print:hidden", { fixed: navOpen })}
            aria-label="Main Menu"
          >
            {!navOpen ? (
              <div className={cn(navItemClasses, "font-bold text-white md:hidden")}>
                {openCompany ? (
                  <CompanyName company={openCompany} />
                ) : (
                  <Image src={logo} className="invert" alt="Flexile" />
                )}
                {toggleButton}
              </div>
            ) : null}
            <div className={cn("h-full flex-col overflow-y-auto text-gray-400 md:flex", navOpen ? "flex" : "hidden")}>
              {!user.companies.length ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Image src={logo} className="w-auto invert md:h-14" alt="Flexile" />
                  {toggleButton}
                </div>
              ) : null}
              {user.companies.map((company, i) => (
                <details key={company.id} open={company.id === openCompanyId}>
                  <summary
                    className={`list-none text-white [&::-webkit-details-marker]:hidden ${navItemClasses} ${company.id === openCompanyId ? "cursor-default" : "cursor-pointer"}`}
                    onClick={e(() => setOpenCompanyId(company.id), "prevent")}
                  >
                    <CompanyName company={company} />
                    {user.companies.length > 1 && (
                      <ChevronDownIcon
                        className={cn("size-5 text-white transition-transform md:ml-auto", {
                          "rotate-180": company.id === openCompanyId,
                        })}
                      />
                    )}
                    {i === 0 && toggleButton}
                  </summary>
                  <NavLinks company={company} />
                </details>
              ))}
          <div className="mt-auto">
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
            <SignOutButton>
              <button className={cn(navLinkClasses, "w-full")}>
                <ArrowRightStartOnRectangleIcon className="h-6 w-8" />
                Log out
              </button>
            </SignOutButton>
          </div>
            </div>
          </nav>
          <div className="flex flex-col not-print:h-screen not-print:overflow-hidden">
              <main className="flex flex-1 flex-col gap-6 pb-4 not-print:overflow-y-auto">
                <div>
                  <header className="border-b bg-gray-200 px-3 pt-8 pb-4 md:px-16">
                    <div className="grid max-w-(--breakpoint-xl) gap-y-8">
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
                </div>
                <div className="mx-3 flex max-w-(--breakpoint-xl) flex-col gap-6 md:mx-16">{children}</div>
              </main>
            {footer ? <div className="mt-auto">{footer}</div> : null}
          </div>
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

const NavLinks = ({ company }: { company: Company }) => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const active = user.currentCompanyId === company.id;
  const routes = new Set(
    company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
  );
  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const switchCompany = useSwitchCompanyOrRole();
  const isRole = (...roles: (typeof user.activeRole)[]) => roles.includes(user.activeRole);
  const equityNavLink = equityNavLinks(user, company)[0];

  return (
    <div
      onClick={() => {
        if (user.currentCompanyId !== company.id) {
          void switchCompany(company.id);
        }
      }}
    >
      {updatesPath ? (
        <>
          <NavLink
            href={updatesPath === "company_updates_company_index" ? "/updates/company" : "/updates/team"}
            icon={MegaphoneIcon}
            filledIcon={SolidMegaphoneIcon}
            active={!!active && pathname.startsWith("/updates")}
          >
            Updates
          </NavLink>
          {routes.has("Company") && routes.has("Team") ? (
            <>
              <NavLink
                href="/updates/company"
                icon={BuildingOfficeIcon}
                filledIcon={SolidBuildingOfficeIcon}
                className="ml-4"
                active={!!active && pathname.startsWith("/updates/company")}
              >
                Company
              </NavLink>
              <NavLink
                href="/updates/team"
                icon={UserGroupIcon}
                filledIcon={SolidUserGroupIcon}
                className="ml-4"
                active={!!active && pathname.startsWith("/updates/team")}
              >
                Team
              </NavLink>
            </>
          ) : null}
        </>
      ) : null}
      {routes.has("Invoices") && (
        <InvoicesNavLink
          companyId={company.id}
          active={!!active && pathname.startsWith("/invoices")}
          isAdmin={isRole("administrator")}
        />
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
          active={
            !!active &&
            (pathname.startsWith("/roles") ||
              pathname.startsWith("/talent_pool") ||
              pathname.startsWith("/role_applications"))
          }
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
          href={isRole("administrator") ? `/administrator/settings` : `/settings/equity`}
          active={!!active && pathname.startsWith("/settings")}
          icon={Cog6ToothIcon}
          filledIcon={SolidCog6ToothIcon}
        >
          Settings
        </NavLink>
      )}
      {company.other_access_roles.map((accessRole) => (
        <SwitchRoleNavLink key={accessRole} accessRole={accessRole} companyId={company.id} />
      ))}
    </div>
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
  icon: React.ComponentType<{ className: string }>;
  filledIcon?: React.ComponentType<{ className: string }>;
  badge?: number | undefined;
}) => {
  const Icon = active && filledIcon ? filledIcon : icon;
  return (
    <Link
      className={cn(navLinkClasses, { "font-bold text-white": active }, className)}
      // @ts-expect-error see the above comment
      href={href}
    >
      <div className="relative">
        <Icon className="h-6 w-8" />
        {badge && badge > 0 ? (
          <Badge
            role="status"
            color="blue"
            className="absolute -top-2 right-0 h-4 w-auto min-w-4 translate-x-1/4 px-1 text-xs"
          >
            {badge > 10 ? "10+" : badge}
          </Badge>
        ) : null}
      </div>
      <span className="truncate">{children}</span>
    </Link>
  );
};

function InvoicesNavLink({ companyId, active, isAdmin }: { companyId: string; active: boolean; isAdmin: boolean }) {
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
    <NavLink
      href="/invoices"
      icon={DocumentTextIcon}
      filledIcon={SolidDocumentTextIcon}
      active={active}
      badge={isAdmin && !isLoading ? data?.total : undefined}
    >
      Invoices
    </NavLink>
  );
}

function SwitchRoleNavLink({ accessRole, companyId }: { accessRole: CompanyAccessRole; companyId: string }) {
  const router = useRouter();
  const switchCompany = useSwitchCompanyOrRole();

  const handleSwitchRole = (e: React.MouseEvent) => {
    e.preventDefault();
    void (async () => {
      await switchCompany(companyId, accessRole);
      router.push("/dashboard");
    })();
  };

  const roleLabel = accessRole === "administrator" ? "admin" : accessRole;
  return (
    <div onClick={handleSwitchRole}>
      <NavLink href="/" icon={ArrowPathIcon}>
        <span className="truncate">Use as {roleLabel}</span>
      </NavLink>
    </div>
  );
}

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
