"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, LogOut, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser } from "@/global";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { switchCompany } from "@/lib/companySwitcher";
import { hasSubItems, type NavLinkInfo, useNavLinks } from "@/lib/useNavLinks";
import { cn } from "@/utils/index";

// Constants
const NAV_PRIORITIES: Record<string, number> = {
  Invoices: 1,
  Documents: 2,
  Equity: 3,
  People: 4,
  Updates: 5,
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
      "hover:text-foreground",
      "group relative",
      isActive && "text-primary",
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
        "pointer-events-none fixed inset-0 z-35 bg-black/50 transition-opacity duration-300",
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
              <button
                onClick={onBack}
                className="hover:bg-accent -ml-2 rounded-md p-1 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <span>{title}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto" style={{ height: "380px" }}>
          {children}
        </div>
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
}

const SheetNavItem = ({ item, image, onClick, showChevron, pathname }: SheetNavItemProps) => {
  const isActive = pathname === item.route || item.isActive;
  const itemIcon = item.icon ? <item.icon className="h-5 w-5" /> : image;

  return (
    <Link href={{ pathname: item.route }}>
      <button
        onClick={onClick}
        className={cn(
          "hover:bg-accent flex items-center gap-3 rounded-md px-6 py-3 transition-colors",
          isActive && "bg-accent text-accent-foreground font-medium",
          "w-full text-left",
        )}
      >
        {itemIcon}
        <span className="font-normal">{item.label}</span>
        {showChevron ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
        {item.badge ? (
          <Badge className="ml-auto bg-blue-500 text-white">{item.badge > 10 ? "10+" : item.badge}</Badge>
        ) : null}
      </button>
    </Link>
  );
};

// Submenu Navigation
interface NavWithSubmenuProps {
  item: NavLinkInfo & { subItems: NonNullable<NavLinkInfo["subItems"]> };
}

const NavWithSubmenu = ({ item }: NavWithSubmenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <NavSheet
      trigger={
        <button
          aria-label={`${item.label} menu`}
          aria-current={item.isActive || isOpen ? "page" : undefined}
          className="w-full"
        >
          <NavIcon {...item} isActive={item.isActive || isOpen} />
        </button>
      }
      title={item.label}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <div className="flex flex-col gap-1">
        {item.subItems.map((subItem) => (
          <SheetNavItem key={subItem.label} item={subItem} pathname={pathname} onClick={() => setIsOpen(false)} />
        ))}
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
        "hover:bg-accent flex w-full items-center gap-3 px-6 py-3 text-left transition-colors",
        company.id === user.currentCompanyId && "bg-accent text-accent-foreground font-medium",
      )}
      aria-label={`Switch to ${company.name}`}
      aria-current={company.id === user.currentCompanyId ? "true" : undefined}
    >
      <Image src={company.logo_url || defaultCompanyLogo} width={20} height={20} className="rounded-xs" alt="" />
      <span className="line-clamp-1 flex-1 text-left font-normal">{company.name}</span>
    </button>
  ));
};

// Overflow Menu
interface OverflowMenuProps {
  items: NavLinkInfo[];
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

const OverflowMenu = ({ items }: OverflowMenuProps) => {
  const user = useCurrentUser();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [navState, setNavState] = useState<NavigationState>({ view: "main" });

  const currentCompany = useMemo(
    () => user.companies.find((c) => c.id === user.currentCompanyId),
    [user.companies, user.currentCompanyId],
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setNavState({ view: "main" });
  };

  const getTitle = () => {
    switch (navState.view) {
      case "companies":
        return "Companies";
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
          <NavIcon icon={MoreHorizontal} label="More" isActive={isOpen} />
        </button>
      }
      title={getTitle()}
      open={isOpen}
      onOpenChange={handleOpenChange}
      onBack={navState.view !== "main" ? () => setNavState({ view: "main" }) : undefined}
    >
      <div className="relative flex h-full flex-col overflow-hidden">
        {/* Main Menu */}
        <ViewTransition show={navState.view === "main"} direction="left" className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            {user.companies.length > 0 && currentCompany ? (
              <SheetNavItem
                item={{ label: currentCompany.name || "Company" }}
                image={
                  <Image
                    src={currentCompany.logo_url || defaultCompanyLogo}
                    width={20}
                    height={20}
                    className="rounded-xs object-contain"
                    alt="company logo"
                  />
                }
                showChevron={user.companies.length > 1}
                pathname={pathname}
                onClick={() => setNavState({ view: "companies" })}
              />
            ) : null}

            {items.map((item) => (
              <SheetNavItem
                key={item.label}
                item={item}
                pathname={pathname}
                {...(item.subItems
                  ? { onClick: () => setNavState({ view: "submenu", selectedItem: item }) }
                  : item.route
                    ? { onClick: () => handleOpenChange(false) }
                    : {})}
                showChevron={!!item.subItems}
              />
            ))}
          </div>

          <SignOutButton>
            <button
              className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-6 py-3 text-left transition-colors"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-normal">Log out</span>
            </button>
          </SignOutButton>
        </ViewTransition>

        {/* Submenu */}
        <ViewTransition show={navState.view === "submenu"} direction="right">
          {navState.selectedItem?.subItems?.map((subItem) => (
            <SheetNavItem
              key={subItem.label}
              item={subItem}
              pathname={pathname}
              onClick={() => handleOpenChange(false)}
            />
          ))}
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
          <li key={item.label} className="flex-1">
            {hasSubItems(item) ? (
              <NavWithSubmenu item={item} />
            ) : (
              <Link href={{ pathname: item.route }}>
                <NavIcon {...item} />
              </Link>
            )}
          </li>
        ))}
        <li className="flex-1">
          <OverflowMenu items={overflowItems} />
        </li>
      </ul>
    </nav>
  );
}
