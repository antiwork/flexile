import { SignOutButton } from "@clerk/nextjs";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BriefcaseIcon,
  ChartPieIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowPathIcon,
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
import { capitalize } from "lodash-es";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { navLinks as equityNavLinks } from "@/app/equity";
import { linkClasses } from "@/components/Link";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import logo from "@/images/flexile-logo.svg";
import { type Company } from "@/models/user";
import { trpc } from "@/trpc/client";
import { cn, e } from "@/utils";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

type CompanyAccessRole = "administrator" | "worker" | "investor" | "lawyer";

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
  const [navOpen, setNavOpen] = useState(false);
  const [openCompanyId, setOpenCompanyId] = useState(user.currentCompanyId);
  useEffect(() => setOpenCompanyId(user.currentCompanyId), [user.currentCompanyId]);
  const openCompany = user.companies.find((company) => company.id === openCompanyId);
  const pathname = usePathname();

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
    <div className={cn("grid md:grid-cols-[14rem_1fr]" /* { "h-full": appConfig.is_demo_mode } */)}>
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
          active={!!active && (pathname.startsWith("/roles") || pathname.startsWith("/role_applications"))}
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
      badge={isAdmin && !isLoading ? data?.length : undefined}
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
