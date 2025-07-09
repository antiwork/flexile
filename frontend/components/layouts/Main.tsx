import { SignOutButton } from "@clerk/nextjs";
import { ChevronsUpDown, LogOut, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { useCurrentUser } from "@/global";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { useIsMobile } from "@/utils/use-mobile";
import { hasSubItems, useNavLinks, type NavLinkInfo } from "@/lib/useNavLinks";
import { CompanySwitcherList, CompanySwitcherHeader } from "@/components/navigation/CompanySwitcher";

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
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      {isMobile ? (
        <MobileBottomNav />
      ) : (
        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            {user.companies.length > 1 ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton size="lg" className="text-base" aria-label="Switch company">
                        <CompanySwitcherHeader />
                        <ChevronsUpDown className="ml-auto" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(radix-dropdown-menu-trigger-width)" align="start">
                      <CompanySwitcherList className="p-1" />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <div className="flex items-center gap-2 p-2">
                <CompanySwitcherHeader />
              </div>
            )}
          </SidebarHeader>
          <SidebarContent>
            {user.currentCompanyId ? (
              <SidebarGroup>
                <SidebarGroupContent>
                  <NavLinks />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
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
      )}
      <SidebarInset>
        <div className="flex flex-col not-print:h-screen not-print:overflow-hidden">
          <main className={`flex flex-1 flex-col pb-4 not-print:overflow-y-auto ${isMobile ? "pb-20" : ""}`}>
            <div>
              <header className="px-3 py-2 md:px-4 md:py-4">
                <div className="grid gap-y-8">
                  <div className="grid items-center justify-between gap-3 md:flex">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        {!isMobile && <SidebarTrigger className="md:hidden" />}
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

const NavLinks = () => {
  const pathname = usePathname();
  const navLinks = useNavLinks();

  return (
    <SidebarMenu>
      {navLinks.map((link) => {
        if (hasSubItems(link)) {
          return <CollapsibleNavLink key={link.label} link={link} pathname={pathname} />;
        }

        if (link.href) {
          return (
            <NavLink key={link.label} href={link.href} icon={link.icon} active={link.isActive} badge={link.badge}>
              {link.label}
            </NavLink>
          );
        }

        return null;
      })}
    </SidebarMenu>
  );
};

interface CollapsibleNavLinkProps {
  link: NavLinkInfo & { subItems: NonNullable<NavLinkInfo["subItems"]> };
  pathname: string;
}

const CollapsibleNavLink = ({ link, pathname }: CollapsibleNavLinkProps) => {
  const Icon = link.icon;
  const storageKey = `${link.label.toLowerCase().replace(/\s+/gu, "-")}-menu-state`;

  const [isOpen, setIsOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "open";
  });

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(state) => {
        setIsOpen(state);
        localStorage.setItem(storageKey, state ? "open" : "closed");
      }}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <Icon />
            <span>{link.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {link.subItems.map((subItem) => (
              <SidebarMenuSubItem key={subItem.route}>
                <SidebarMenuSubButton asChild isActive={pathname === subItem.route}>
                  <Link href={{ pathname: subItem.route }}>{subItem.label}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
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
  href: string | { pathname: string };
  active?: boolean;
  icon: React.ComponentType;
  filledIcon?: React.ComponentType;
  badge?: number | undefined;
}) => {
  const Icon = active && filledIcon ? filledIcon : icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active ?? false} className={className}>
        <Link href={typeof href === "string" ? { pathname: href } : href}>
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
