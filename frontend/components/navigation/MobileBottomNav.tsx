"use client";

import { ChevronLeft, ChevronRight, LogOut, MessageCircleQuestion, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { NavBadge } from "@/components/navigation/NavBadge";
import { SupportBadge } from "@/components/Support";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser, useUserStore } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { useSwitchCompany } from "@/lib/companySwitcher";
import { hasSubItems, type NavLinkInfo, useNavLinks } from "@/lib/useNavLinks";
import { cn } from "@/utils/index";

// Constants
const NAV_PRIORITIES: Record<string, number> = {
  Invoices: 1,
  Documents: 2,
  Equity: 3,
  Updates: 4,
  People: 5,
  Expenses: 6,
  Roles: 7,
  Settings: 8,
};

const DEFAULT_PRIORITY = 99;
const MAX_VISIBLE_ITEMS = 3;

type SheetView = "main" | "submenu" | "companies";

interface NavigationState {
  view: SheetView;
  selectedItem?: NavLinkInfo | undefined;
}

interface NavIconProps extends NavLinkInfo {
  className?: string;
}

const NavIcon = ({ icon: Icon, label, badge, isActive, className }: NavIconProps) => (
  <div
    className={cn(
      "flex h-full flex-col items-center justify-center p-2 pt-3",
      "text-muted-foreground transition-all duration-200",
      "group relative",
      isActive && "text-blue-500",
      className,
    )}
  >
    {Icon ? <Icon className="mb-1 h-5 w-5" /> : null}
    <span className="text-xs font-normal">{label}</span>
    {badge ? (
      <span className="absolute top-2 right-1/2 flex h-3.5 w-3.5 translate-x-4 -translate-y-1 rounded-full border-3 border-white bg-blue-500" />
    ) : null}
  </div>
);

interface NavSheetProps {
  trigger: React.ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack?: (() => void) | undefined;
  children: React.ReactNode;
}

// Portal overlay component
const SheetOverlay = ({ open }: { open: boolean }) =>
  ReactDOM.createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-35 bg-black/50 transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0",
      )}
      aria-hidden="true"
    />,
    document.getElementById("sidebar-wrapper") ?? document.body,
  );

const NavSheet = ({ trigger, title, open, onOpenChange, onBack, children }: NavSheetProps) => (
  <>
    <SheetOverlay open={!!open} />
    <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="bottom-14 z-50 rounded-t-2xl pb-4 not-print:border-t-0">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex h-5 items-center gap-2">
            {onBack ? (
              <button onClick={onBack} className="-ml-2 rounded-md p-1 transition-colors" aria-label="Go back">
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <span>{title}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  </>
);

// Navigation Sheet Items
interface SheetNavItemProps {
  item: NavLinkInfo;
  image?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  pathname?: string;
  className?: string;
}

const SheetNavItem = ({ item, image, onClick, showChevron, pathname, className }: SheetNavItemProps) => (
  <Link
    href={{ pathname: item.route }}
    {...(onClick ? { onClick } : {})}
    {...(!item.route && { role: "button" })}
    className={cn(
      "flex items-center gap-3 rounded-none px-6 py-3 transition-colors",
      (pathname === item.route || item.isActive) && "bg-accent text-accent-foreground font-medium",
      "w-full text-left",
      className,
    )}
  >
    {item.icon ? <item.icon className="h-5 w-5" /> : image}
    <span>{item.label}</span>
    {showChevron ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
    {typeof item.badge === "number" ? <NavBadge count={item.badge} /> : item.badge}
  </Link>
);

// Helper function to group items by category
const groupItemsByCategory = (items: NavLinkInfo["subItems"]) => {
  if (!items) return {};

  const grouped: Record<string, typeof items> = {};

  items.forEach((item) => {
    const category = item.category ?? "uncategorized";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });

  return grouped;
};

// Grouped Subitems Renderer
interface GroupedSubitemsProps {
  subItems: NonNullable<NavLinkInfo["subItems"]>;
  pathname: string;
  onItemClick: () => void;
}

const GroupedSubitems = ({ subItems, pathname, onItemClick }: GroupedSubitemsProps) => {
  const groupedItems = useMemo(() => groupItemsByCategory(subItems), [subItems]);
  const hasCategories = Object.keys(groupedItems).some((key) => key !== "uncategorized");

  if (!hasCategories) {
    return (
      <>
        {subItems.map((subItem) => (
          <SheetNavItem key={subItem.label} item={subItem} pathname={pathname} onClick={onItemClick} />
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <React.Fragment key={category}>
          <div className="flex flex-col gap-1">
            {category !== "uncategorized" && (
              <div className="text-muted-foreground px-4 py-4 text-sm tracking-wider capitalize">{category}</div>
            )}
            {categoryItems.map((subItem) => (
              <SheetNavItem key={subItem.label} item={subItem} pathname={pathname} onClick={onItemClick} />
            ))}
          </div>
          <div className="bg-border mt-3 mb-2 h-px w-full last:hidden" />
        </React.Fragment>
      ))}
    </div>
  );
};

// Submenu Navigation
interface NavWithSubmenuProps {
  item: NavLinkInfo & { subItems: NonNullable<NavLinkInfo["subItems"]> };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NavWithSubmenu = ({ item, open, onOpenChange }: NavWithSubmenuProps) => {
  const pathname = usePathname();

  return (
    <NavSheet
      trigger={
        <button aria-label={`${item.label} menu`} aria-current={open ? "page" : undefined} className="w-full">
          <NavIcon {...item} isActive={open} />
        </button>
      }
      title={item.label}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-1">
        <GroupedSubitems subItems={item.subItems} pathname={pathname} onItemClick={() => onOpenChange(false)} />
      </div>
    </NavSheet>
  );
};

// Company Switcher
interface CompanySwitcherProps {
  onSelect: () => void;
}

const CompanySwitcher = ({ onSelect }: CompanySwitcherProps) => {
  const user = useCurrentUser();
  const { switchCompany } = useSwitchCompany();

  const handleCompanySwitch = async (companyId: string) => {
    if (user.currentCompanyId !== companyId) {
      await switchCompany(companyId);
    }
    onSelect();
  };

  return user.companies.map((company) => (
    <button
      key={company.id}
      onClick={() => void handleCompanySwitch(company.id)}
      className={cn(
        "flex w-full items-center gap-3 px-6 py-3 text-left transition-colors",
        company.id === user.currentCompanyId && "bg-accent text-accent-foreground font-medium",
      )}
      aria-label={`Switch to ${company.name}`}
      aria-current={company.id === user.currentCompanyId ? "true" : undefined}
    >
      <Image src={company.logo_url ?? defaultCompanyLogo.src} width={20} height={20} className="rounded-xs" alt="" />
      <span className="line-clamp-1 flex-1 text-left font-normal">{company.name}</span>
    </button>
  ));
};

// Overflow Menu
interface OverflowMenuProps {
  items: NavLinkInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ViewTransition = ({
  children,
  show,
  direction = "left",
  className,
}: {
  children: React.ReactNode;
  show: boolean;
  direction?: "left" | "right";
  className?: string;
}) => (
  <div
    className={cn(
      "transition-transform duration-200 ease-in-out",
      show ? "translate-x-0 opacity-100" : "absolute inset-0 opacity-0",
      !show && (direction === "left" ? "-translate-x-full" : "translate-x-full"),
      className,
    )}
  >
    {children}
  </div>
);

const OverflowMenu = ({ items, onOpenChange, open }: OverflowMenuProps) => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const [navState, setNavState] = useState<NavigationState>({ view: "main" });
  const { data: session } = useSession();
  const { logout } = useUserStore();

  const handleLogout = async () => {
    if (session?.user) await signOut({ redirect: false });
    logout();
    window.location.href = "/login";
  };

  const currentCompany = useMemo(
    () => user.companies.find((c) => c.id === user.currentCompanyId),
    [user.companies, user.currentCompanyId],
  );

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) setNavState({ view: "main" });
  };

  const getTitle = () => {
    switch (navState.view) {
      case "companies":
        return "Workspaces";
      case "submenu":
        return navState.selectedItem?.label || "Submenu";
      default:
        return "More";
    }
  };

  return (
    <NavSheet
      trigger={
        <button aria-label="More" className="w-full">
          <NavIcon icon={MoreHorizontal} label="More" isActive={open} />
        </button>
      }
      title={getTitle()}
      open={open}
      onOpenChange={handleOpenChange}
      onBack={navState.view !== "main" ? () => setNavState({ view: "main" }) : undefined}
    >
      <div className="relative flex h-full flex-col overflow-hidden">
        {/* Main Menu */}
        <ViewTransition show={navState.view === "main"} direction="left" className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            {user.companies.length > 0 && currentCompany ? (
              <SheetNavItem
                item={{ label: currentCompany.name ?? "Personal" }}
                image={
                  <Image
                    src={currentCompany.logo_url ?? defaultCompanyLogo.src}
                    width={20}
                    height={20}
                    className="rounded-xs object-contain"
                    alt="company logo"
                  />
                }
                showChevron={user.companies.length > 1}
                pathname={pathname}
                onClick={() => user.companies.length > 1 && setNavState({ view: "companies" })}
              />
            ) : null}

            {items.map((item) => (
              <SheetNavItem
                key={item.label}
                item={item}
                pathname={pathname}
                onClick={() => {
                  if (item.subItems && item.subItems.length > 0) setNavState({ view: "submenu", selectedItem: item });
                  if (item.route) handleOpenChange(false);
                }}
                showChevron={!!item.subItems}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <SheetNavItem
              pathname={pathname}
              onClick={() => handleOpenChange(false)}
              item={{
                label: "Support center",
                route: "/support",
                icon: MessageCircleQuestion,
                badge: <SupportBadge />,
              }}
            />
            <button
              className="flex w-full items-center gap-3 rounded-none px-6 py-3 text-left transition-colors"
              aria-label="Log out"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-5 w-5" />
              <span className="font-normal">Log out</span>
            </button>
          </div>
        </ViewTransition>

        {/* Submenu */}
        <ViewTransition show={navState.view === "submenu"} direction="right">
          <GroupedSubitems
            subItems={navState.selectedItem?.subItems ?? []}
            pathname={pathname}
            onItemClick={() => handleOpenChange(false)}
          />
        </ViewTransition>

        {/* Companies */}
        <ViewTransition show={navState.view === "companies"} direction="right">
          <CompanySwitcher onSelect={() => handleOpenChange(false)} />
        </ViewTransition>
      </div>
    </NavSheet>
  );
};

// Main Component
export function MobileBottomNav() {
  const allNavLinks = useNavLinks();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  const { mainItems, overflowItems } = useMemo(() => {
    const sorted = [...allNavLinks].sort(
      (a, b) => (NAV_PRIORITIES[a.label] ?? DEFAULT_PRIORITY) - (NAV_PRIORITIES[b.label] ?? DEFAULT_PRIORITY),
    );

    return {
      mainItems: sorted.slice(0, MAX_VISIBLE_ITEMS),
      overflowItems: sorted.slice(MAX_VISIBLE_ITEMS),
    };
  }, [allNavLinks]);

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className="bg-background border-border fixed right-0 bottom-0 left-0 z-60 h-15 border-t"
    >
      <ul role="list" className="flex items-center justify-around">
        {mainItems.map((item) => (
          <li aria-label={item.label} key={item.label} className="flex-1">
            {hasSubItems(item) ? (
              <NavWithSubmenu
                item={item}
                open={activeSheetId === item.label}
                onOpenChange={(open) => setActiveSheetId(open ? item.label : null)}
              />
            ) : (
              <Link href={{ pathname: item.route }}>
                <NavIcon {...item} isActive={typeof activeSheetId === "string" ? false : !!item.isActive} />
              </Link>
            )}
          </li>
        ))}
        <li aria-label="More" className="flex-1">
          <OverflowMenu
            items={overflowItems}
            onOpenChange={(open) => setActiveSheetId(open ? "nav-overflow" : null)}
            open={activeSheetId === "nav-overflow"}
          />
        </li>
      </ul>
    </nav>
  );
}
