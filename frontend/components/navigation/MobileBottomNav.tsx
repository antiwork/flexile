"use client";

import { cn } from "@/utils/index";
import { MoreVertical, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useNavLinks, type NavLinkInfo, hasSubItems } from "@/lib/useNavLinks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import React, { useMemo } from "react";
import { useCurrentUser } from "@/global";
import { SignOutButton } from "@clerk/nextjs";
import { Separator } from "@/components/ui/separator";
import { CompanySwitcherList } from "@/components/navigation/CompanySwitcher";

const NAV_PRIORITIES: Record<string, number> = {
  Invoices: 1,
  People: 2,
  Documents: 3,
  Equity: 4,
  Updates: 5,
  Expenses: 6,
  Roles: 7,
  Settings: 8,
};

const DEFAULT_PRIORITY = 99;
const MAX_VISIBLE_ITEMS = 4;

interface NavItem extends NavLinkInfo {
  priority: number;
}

const NavIconButton = ({ icon: Icon, label, isActive, badge, className }: NavItem & { className?: string }) => (
  <div
    className={cn(
      "flex h-full flex-col items-center justify-center p-2",
      "text-muted-foreground transition-all duration-200",
      "hover:text-foreground active:scale-95",
      "group relative",
      isActive && "text-primary",
      className,
    )}
  >
    <Icon className={cn("mb-1 h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
    <span className="text-xs font-medium">{label}</span>

    {!!badge && (
      <span className="absolute top-2 right-1/2 flex h-5 w-5 translate-x-4 -translate-y-1 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
        {badge > 10 ? "10+" : badge}
      </span>
    )}

    {isActive ? (
      <span className="bg-primary absolute -bottom-[1px] left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-t-full" />
    ) : null}
  </div>
);

const SimpleNavItem = ({ item }: { item: NavItem }) => {
  if (!item.href) return null;

  return (
    <Link
      href={typeof item.href === "string" ? { pathname: item.href } : item.href}
      aria-label={`Navigate to ${item.label}`}
      aria-current={item.isActive ? "page" : undefined}
    >
      <NavIconButton {...item} />
    </Link>
  );
};

const NavItemWithSubmenu = ({ item }: { item: NavItem & { subItems: NonNullable<NavItem["subItems"]> } }) => {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label={`${item.label} menu`} aria-current={item.isActive ? "page" : undefined} className="w-full">
          <NavIconButton {...item} />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>{item.label}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1">
          {item.subItems.map((subItem) => (
            <Link
              key={subItem.label}
              href={{ pathname: subItem.route }}
              className={cn(
                "flex items-center px-6 py-2",
                pathname === subItem.route && "bg-accent text-accent-foreground",
              )}
            >
              <span className="font-medium">{subItem.label}</span>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const OverflowMenu = ({ items }: { items: NavItem[] }) => {
  const pathname = usePathname();
  const user = useCurrentUser();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="More navigation options"
          className="text-muted-foreground hover:text-foreground flex h-full w-full flex-col items-center justify-center p-2 transition-colors active:scale-95"
        >
          <MoreVertical className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>More Options</SheetTitle>
        </SheetHeader>
        <div>
          {/* Company section */}
          {user.companies.length > 0 && (
            <>
              <CompanySwitcherList itemClassName="px-6 py-3 font-medium" />
              {items.length > 0 && <Separator className="my-0" />}
            </>
          )}

          {/* Navigation items */}
          {items.map((item) => (
            <React.Fragment key={item.label}>
              {item.subItems ? (
                <SubmenuSection item={item} pathname={pathname} />
              ) : item.href ? (
                <OverflowLink item={item} />
              ) : null}
            </React.Fragment>
          ))}

          {/* Log out section */}
          <Separator className="my-0" />
          <SignOutButton>
            <button
              className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-6 py-3 text-left transition-colors"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Log out</span>
            </button>
          </SignOutButton>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SubmenuSection = ({ item, pathname }: { item: NavItem; pathname: string }) => (
  <>
    <div className="text-muted-foreground flex items-center gap-3 font-medium">
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
    </div>
    <div className="space-y-1">
      {item.subItems?.map((subItem) => (
        <Link
          key={subItem.label}
          href={{ pathname: subItem.route }}
          className={cn(
            "hover:bg-accent block rounded-md px-6 py-2 text-sm transition-colors",
            pathname === subItem.route && "bg-accent text-accent-foreground",
          )}
        >
          {subItem.label}
        </Link>
      ))}
    </div>
  </>
);

const OverflowLink = ({ item }: { item: NavItem }) => (
  <Link
    href={item.href ? (typeof item.href === "string" ? { pathname: item.href } : item.href) : {}}
    className={cn(
      "hover:bg-accent flex items-center gap-3 rounded-md px-6 py-3 transition-colors",
      item.isActive && "bg-accent text-accent-foreground",
    )}
  >
    <item.icon className="h-5 w-5" />
    <span className="font-medium">{item.label}</span>
    {item.badge ? (
      <Badge className="ml-auto bg-blue-500 text-white">{item.badge > 10 ? "10+" : item.badge}</Badge>
    ) : null}
  </Link>
);

const getItemPriority = (label: string): number => NAV_PRIORITIES[label] ?? DEFAULT_PRIORITY;

// Main navigation component
export function MobileBottomNav() {
  const allNavLinks = useNavLinks();

  const { mainNavItems, overflowItems } = useMemo(() => {
    const navItemsWithPriority: NavItem[] = allNavLinks.map((link) => ({
      ...link,
      priority: getItemPriority(link.label),
    }));

    const sorted = navItemsWithPriority.sort((a, b) => a.priority - b.priority);

    return {
      mainNavItems: sorted.slice(0, Math.min(MAX_VISIBLE_ITEMS, sorted.length)),
      overflowItems: sorted.slice(MAX_VISIBLE_ITEMS),
    };
  }, [allNavLinks]);

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50",
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur",
        "border-border border-t",
      )}
    >
      <ul role="list" className="flex items-center justify-around">
        {mainNavItems.map((item) => (
          <li key={item.label} className="flex-1">
            {hasSubItems(item) ? <NavItemWithSubmenu item={item} /> : <SimpleNavItem item={item} />}
          </li>
        ))}
        <li className="flex-1">
          <OverflowMenu items={overflowItems} />
        </li>
      </ul>
    </nav>
  );
}
