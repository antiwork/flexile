import {
  Briefcase,
  Building,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  Files,
  Landmark,
  LogOut,
  MessageCircleQuestion,
  MoreHorizontal,
  PieChart,
  ReceiptIcon,
  ScrollText,
  Settings,
  ShieldUser,
  Sparkles,
  UserCircle2,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as React from "react";
import type { TabLink } from "@/components/Tabs";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import type { Company, CurrentUser } from "@/models/user";
import { cn } from "@/utils";
import { useNavData } from "@/utils/use-navdata";

type SheetType = "equity" | "more" | "settings" | "company" | null;

const MobileNavItem = ({
  href,
  icon,
  label,
  active,
  badge,
  onClick,
  asButton = false,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  asButton?: boolean;
}) => {
  const content = (
    <>
      <div className="relative flex flex-col items-center">
        {icon}
        {typeof badge === "number" && badge > 0 ? (
          <Badge className="absolute -top-2 left-4 h-3 w-auto min-w-3 bg-blue-500 px-1 text-xs text-white">
            {badge > 10 ? "10+" : badge}
          </Badge>
        ) : null}
      </div>
      <span className={active ? "font-semibold text-blue-500" : "text-gray-400"}>{label}</span>
    </>
  );

  if (asButton) {
    return (
      <li className="mx-1 flex flex-1 justify-center">
        <button
          className="flex flex-col items-center pt-1 text-xs text-gray-500 hover:text-black focus:outline-none"
          aria-label={label}
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li className="mx-1 flex flex-1 justify-center">
      <Link
        href={{ pathname: href || "#" }}
        className="flex flex-col items-center pt-1 text-xs"
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {content}
      </Link>
    </li>
  );
};

const MobileNavLinks = ({
  onEquityClick,
  onMoreClick,
  openSheet,
}: {
  onEquityClick: () => void;
  onMoreClick: () => void;
  openSheet: SheetType;
}) => {
  const { pathname, routes, invoicesData, isInvoiceActionable, documentsData, equityLinks } = useNavData();
  const sidebar = useSidebar();
  const invoicesBadgeCount = invoicesData?.filter(isInvoiceActionable).length ?? 0;
  const documentsBadgeCount = documentsData?.length ?? 0;

  const handleNavClick = (callback: () => void) => {
    callback();
    sidebar.setOpenMobile(false);
  };

  const moreActive = openSheet === "more" || openSheet === "settings" || openSheet === "company";

  return (
    <ul className="flex h-16 items-center justify-between px-2">
      {routes.has("Invoices") && (
        <MobileNavItem
          href="/invoices"
          icon={
            <ReceiptIcon
              className={cn(
                "mb-1 size-6",
                openSheet === null && pathname.startsWith("/invoices") ? "text-blue-500" : "text-gray-400",
              )}
            />
          }
          label="Invoices"
          active={openSheet === null && pathname.startsWith("/invoices")}
          badge={invoicesBadgeCount}
          onClick={() => handleNavClick(() => sidebar.setOpenMobile(false))}
        />
      )}
      {routes.has("Documents") && (
        <MobileNavItem
          href="/documents"
          icon={
            <Files
              className={cn(
                "mb-1 size-6",
                openSheet === null && pathname.startsWith("/documents") ? "text-blue-500" : "text-gray-400",
              )}
            />
          }
          label="Documents"
          active={openSheet === null && pathname.startsWith("/documents")}
          badge={documentsBadgeCount}
          onClick={() => handleNavClick(() => sidebar.setOpenMobile(false))}
        />
      )}
      {routes.has("People") && (
        <MobileNavItem
          href="/people"
          icon={
            <Users
              className={cn(
                "mb-1 size-6",
                openSheet === null && (pathname.startsWith("/people") || pathname.includes("/investor_entities/"))
                  ? "text-blue-500"
                  : "text-gray-400",
              )}
            />
          }
          label="People"
          active={openSheet === null && (pathname.startsWith("/people") || pathname.includes("/investor_entities/"))}
          onClick={() => handleNavClick(() => sidebar.setOpenMobile(false))}
        />
      )}
      {routes.has("Equity") && equityLinks.length > 0 && (
        <MobileNavItem
          icon={<ChartPie className={cn("mb-1 size-6", openSheet === "equity" ? "text-blue-500" : "text-gray-400")} />}
          label="Equity"
          active={openSheet === "equity"}
          onClick={() => handleNavClick(onEquityClick)}
          asButton
        />
      )}
      <MobileNavItem
        icon={<MoreHorizontal className={cn("mb-1 size-6", moreActive ? "text-blue-500" : "text-gray-400")} />}
        label="More"
        active={moreActive}
        onClick={() => handleNavClick(onMoreClick)}
        asButton
      />
    </ul>
  );
};

const EquitySheet = ({
  open,
  onOpenChange,
  equityLinks,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equityLinks: TabLink[];
  onClose: () => void;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="mb-16 h-auto max-h-[80vh] rounded-t-[20px] border-0 pb-2"
      showCloseButton={false}
    >
      <SheetHeader className="pb-0">
        <SheetTitle>Equity</SheetTitle>
      </SheetHeader>
      <div className="space-y-2">
        {equityLinks.map((link) => (
          <Link
            key={link.label}
            href={link.route}
            className="flex w-full items-center rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
            onClick={onClose}
          >
            <span>{link.label}</span>
          </Link>
        ))}
      </div>
    </SheetContent>
  </Sheet>
);

const SettingsSheet = ({
  open,
  onOpenChange,
  onClose,
  onBackToMore,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onBackToMore: () => void;
  user: CurrentUser;
}) => {
  const goBack = () => {
    onBackToMore();
  };

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
  ] as const;

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
      label: "Equity",
      route: "/settings/administrator/equity" as const,
      icon: PieChart,
      isVisible: (user: CurrentUser) => !!user.roles.administrator,
    },
  ] as const;

  const filteredPersonalLinks = personalLinks.filter((link) => link.isVisible(user));
  const filteredCompanyLinks = companyLinks.filter((link) => link.isVisible(user));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="inset-x-0 inset-y-auto top-auto bottom-16 h-auto max-h-[80vh] rounded-t-[20px] border-0 not-print:border-l-0"
        showCloseButton={false}
      >
        <SheetHeader className="flex flex-row items-center space-y-0 pb-4">
          <button onClick={goBack} className="mr-3 rounded-full p-1 hover:bg-gray-100">
            <ChevronLeft className="size-5" />
          </button>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-0 space-y-1">
          {filteredPersonalLinks.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 pl-4 text-xs font-medium tracking-wider text-gray-500 uppercase">Personal</h3>
              {filteredPersonalLinks.map((link) => (
                <Link
                  key={link.route}
                  href={link.route}
                  className="flex w-full items-center rounded-lg px-4 py-3 pl-8 text-left transition-colors hover:bg-gray-100"
                  onClick={onClose}
                >
                  <link.icon className="mr-3 size-5" />
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          )}
          <hr className="my-4 border-t border-gray-200" />

          {filteredCompanyLinks.length > 0 && (
            <div className="mb-0">
              <h3 className="mb-2 pl-4 text-xs font-medium tracking-wider text-gray-500 uppercase">Company</h3>
              {filteredCompanyLinks.map((link) => (
                <Link
                  key={link.route}
                  href={link.route}
                  className="flex w-full items-center rounded-lg px-4 py-3 pl-8 text-left transition-colors hover:bg-gray-100"
                  onClick={onClose}
                >
                  <link.icon className="mr-3 size-5" />
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const CompanySheet = ({
  open,
  onOpenChange,
  user,
  switchCompany,
  onClose,
  onBackToMore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser;
  switchCompany: (companyId: string) => Promise<void>;
  onClose: () => void;
  onBackToMore: () => void;
}) => {
  const goBack = () => {
    onBackToMore();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mb-16 h-auto max-h-[80vh] rounded-t-[20px] border-0 pb-2"
        showCloseButton={false}
      >
        <SheetHeader className="flex flex-row items-center space-y-0 pb-2">
          <button onClick={goBack} className="mr-3 rounded-full p-1 hover:bg-gray-100">
            <ChevronLeft className="size-5" />
          </button>
          <SheetTitle>Company</SheetTitle>
        </SheetHeader>
        <div className="mt-0 space-y-2">
          {user.companies.map((companyItem) => (
            <button
              key={companyItem.id}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
              onClick={() => {
                if (user.currentCompanyId !== companyItem.id) void switchCompany(companyItem.id);
                onClose();
              }}
            >
              <div
                className={`flex size-6 items-center justify-center rounded-sm ${
                  !companyItem.logo_url || companyItem.logo_url.includes("default-company-logo")
                    ? "border border-gray-200 bg-gray-50"
                    : ""
                }`}
              >
                <Image
                  src={companyItem.logo_url ?? defaultCompanyLogo.src}
                  className={
                    !companyItem.logo_url || companyItem.logo_url.includes("default-company-logo")
                      ? "size-4"
                      : "size-6 shrink-0 rounded"
                  }
                  width={24}
                  height={24}
                  alt={`${companyItem.name ?? "Personal"} logo`}
                />
              </div>
              <span className="flex-1 text-left">{companyItem.name || "Personal"}</span>
              {companyItem.id === user.currentCompanyId && (
                <div className="size-2 flex-shrink-0 rounded-full bg-blue-500"></div>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const MoreSheet = ({
  open,
  onOpenChange,
  onSettingsClick,
  onCompanyClick,
  onLogout,
  user,
  company,
  canShowTryEquity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsClick: () => void;
  onCompanyClick: () => void;
  onLogout: () => void;
  user: CurrentUser;
  company: Company;
  canShowTryEquity: boolean;
}) => {
  const isDefaultLogo = !company.logo_url || company.logo_url.includes("default-company-logo");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mb-16 h-auto max-h-[80vh] rounded-t-[20px] border-0"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="mt-0 space-y-2">
          {user.companies.length > 1 ? (
            <button
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
              onClick={onCompanyClick}
            >
              <div
                className={`flex size-6 items-center justify-center rounded-sm ${
                  isDefaultLogo ? "border border-gray-200 bg-gray-50" : ""
                }`}
              >
                <Image
                  src={company.logo_url ?? defaultCompanyLogo.src}
                  className={isDefaultLogo ? "size-4" : "size-6 shrink-0 rounded"}
                  width={24}
                  height={24}
                  alt={`${company.name ?? "Personal"} logo`}
                />
              </div>
              <span className="flex-1">{company.name ?? "Personal"}</span>
              <ChevronsUpDown className="size-4" />
            </button>
          ) : (
            <div className="flex w-full items-center gap-3 rounded-lg px-4 py-3">
              <div
                className={`flex size-6 items-center justify-center rounded-sm ${
                  isDefaultLogo ? "border border-gray-200 bg-gray-50" : ""
                }`}
              >
                <Image
                  src={company.logo_url ?? defaultCompanyLogo.src}
                  className={isDefaultLogo ? "size-4" : "size-6 shrink-0 rounded"}
                  width={24}
                  height={24}
                  alt={`${company.name ?? "Personal"} logo`}
                />
              </div>
              <span className="flex-1">{company.name ?? "Personal"}</span>
            </div>
          )}

          {canShowTryEquity ? (
            <Link
              href="/settings/administrator/equity"
              className="flex w-full items-center rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
              onClick={() => onOpenChange(false)}
            >
              <Sparkles className="mr-3 size-5" />
              <span>Try equity</span>
            </Link>
          ) : null}

          <button
            className="flex w-full items-center rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
            onClick={onSettingsClick}
          >
            <Settings className="mr-3 size-5" />
            <span className="flex-1">Settings</span>
            <ChevronRight className="size-4 text-gray-400" />
          </button>

          <Link
            href="/support"
            className="flex w-full items-center rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            <MessageCircleQuestion className="mr-3 size-5" />
            <span>Support center</span>
          </Link>

          <button
            className="flex w-full items-center rounded-lg px-4 py-3 text-left transition-colors hover:bg-gray-100"
            onClick={() => {
              onOpenChange(false);
              onLogout();
            }}
            type="button"
          >
            <LogOut className="mr-3 size-5" />
            <span>Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default function BottomNavbar() {
  const [openSheet, setOpenSheet] = React.useState<SheetType>(null);
  const { user, company, equityLinks, switchCompany, logout } = useNavData();

  const closeSheet = () => setOpenSheet(null);

  const canShowTryEquity = Boolean(user?.roles?.administrator && !company?.equityEnabled);

  const handleBackToMore = () => {
    setOpenSheet("more");
  };

  const handleEquityClick = () => {
    if (openSheet === "equity") {
      setOpenSheet(null);
    } else {
      setOpenSheet("equity");
    }
  };

  const handleMoreClick = () => {
    if (openSheet === "more") {
      setOpenSheet(null);
    } else {
      setOpenSheet("more");
    }
  };

  const handleSettingsClick = () => {
    setOpenSheet("settings");
  };

  const handleCompanyClick = () => {
    setOpenSheet("company");
  };

  return (
    <>
      <EquitySheet
        open={openSheet === "equity"}
        onOpenChange={(open: boolean) => !open && closeSheet()}
        equityLinks={equityLinks}
        onClose={closeSheet}
      />

      <SettingsSheet
        open={openSheet === "settings"}
        onOpenChange={(open: boolean) => !open && closeSheet()}
        onClose={closeSheet}
        onBackToMore={handleBackToMore}
        user={user}
      />

      <CompanySheet
        open={openSheet === "company"}
        onOpenChange={(open: boolean) => !open && closeSheet()}
        user={user}
        switchCompany={switchCompany}
        onClose={closeSheet}
        onBackToMore={handleBackToMore}
      />

      <MoreSheet
        open={openSheet === "more"}
        onOpenChange={(open: boolean) => !open && closeSheet()}
        onSettingsClick={handleSettingsClick}
        onCompanyClick={handleCompanyClick}
        onLogout={() => void signOut({ redirect: false }).then(logout)}
        user={user}
        company={company}
        canShowTryEquity={canShowTryEquity}
      />

      <nav className="fixed right-0 bottom-0 left-0 z-[100] border-t border-gray-200 bg-white shadow-lg md:hidden">
        <MobileNavLinks onEquityClick={handleEquityClick} onMoreClick={handleMoreClick} openSheet={openSheet} />
      </nav>
    </>
  );
}
