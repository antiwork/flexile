import { SignOutButton } from "@clerk/nextjs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { skipToken } from "@tanstack/react-query";
import {
  ChartPie,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  Files,
  LogOut,
  type LucideProps,
  ReceiptIcon,
  Rss,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { navLinks as equityNavLinks } from "@/app/(dashboard)/equity";
import { useIsActionable } from "@/app/(dashboard)/invoices";
import { CompanyName } from "@/components/CompanyName";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { switchCompany } from "@/lib/switch-company";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import defaultCompanyLogo from "../images/default-company-logo.svg";

const NAV_HEIGHT_PX = 49;
type DialogType = "equity" | "show_more" | null;

const MobileNav = () => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [dialog, setDialog] = useState<DialogType>(null);
  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;

  const isInvoiceActionable = useIsActionable();
  const equityLinks = useMemo(() => equityNavLinks(user, company), [user, company]);

  const routes = useMemo(
    () =>
      new Set(
        company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
      ),
    [company.routes],
  );

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    user.currentCompanyId && user.roles.administrator
      ? { companyId: user.currentCompanyId, status: ["received", "approved", "failed"] }
      : skipToken,
    { refetchInterval: 30_000 },
  );

  const toggleDialog = (dialogType: DialogType) => {
    setDialog((current) => (current === dialogType ? null : dialogType));
  };

  const renderEquityDialog = () => (
    <BottomSheetDialog open={dialog === "equity"} title="Equity" onClose={() => toggleDialog(null)}>
      {equityLinks.map((item, index) => (
        <Link
          key={index}
          href={item.route}
          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
          onClick={() => setDialog(null)}
        >
          <span>{item.label}</span>
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </Link>
      ))}
    </BottomSheetDialog>
  );

  const renderShowMoreDialog = () => (
    <BottomSheetDialog open={dialog === "show_more"} title="More" onClose={() => toggleDialog(null)}>
      {user.companies.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full cursor-pointer items-center gap-2 px-6 py-4 hover:bg-gray-50">
              <CompanyName />
              <ChevronsUpDown className="ml-auto h-4 w-4 text-gray-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="bg-white">
            {user.companies.map((company) => (
              <DropdownMenuItem
                key={company.id}
                onSelect={() => {
                  if (user.currentCompanyId !== company.id) switchCompany(company.id);
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
      ) : user.companies[0]?.name ? (
        <div className="flex items-center gap-2 px-6 py-4">
          <CompanyName />
        </div>
      ) : null}
      {updatesPath ? (
        <Link
          href="/updates/company"
          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
          onClick={() => setDialog(null)}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center">
              <Rss className="h-4 w-4" />
            </div>
            <span>Updates</span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </Link>
      ) : null}
      <Link
        href="/settings"
        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
        onClick={() => setDialog(null)}
      >
        <div className="flex gap-2">
          <div className="flex h-6 w-6 items-center justify-center">
            <Settings className="h-4 w-4" />
          </div>
          <span>Settings</span>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-600" />
      </Link>
      <SignOutButton>
        <Link href="#" className="flex items-center px-6 py-4 hover:bg-gray-50" onClick={() => setDialog(null)}>
          <div className="flex gap-2">
            <div className="flex h-6 w-6 items-center justify-center">
              <LogOut className="h-4 w-4" />
            </div>
            <span>Log out</span>
          </div>
        </Link>
      </SignOutButton>
    </BottomSheetDialog>
  );

  return (
    <>
      {renderEquityDialog()}
      {renderShowMoreDialog()}
      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-[45] flex bg-white pt-0.5"
        style={{
          height: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
          paddingBottom: `env(safe-area-inset-bottom)`,
        }}
      >
        {routes.has("Invoices") && (
          <MobileNavItem
            href="/invoices"
            icon={ReceiptIcon}
            active={pathname.startsWith("/invoices")}
            badge={invoicesData?.filter(isInvoiceActionable).length ?? 0}
            onClick={() => toggleDialog(null)}
          >
            Invoices
          </MobileNavItem>
        )}
        {routes.has("Documents") && (
          <MobileNavItem
            href="/documents"
            icon={Files}
            active={pathname.startsWith("/documents") || pathname.startsWith("/document_templates")}
            onClick={() => toggleDialog(null)}
          >
            Documents
          </MobileNavItem>
        )}
        {routes.has("People") && (
          <MobileNavItem
            href="/people"
            icon={Users}
            active={pathname.startsWith("/people") || pathname.includes("/investor_entities/")}
            onClick={() => toggleDialog(null)}
          >
            People
          </MobileNavItem>
        )}
        {routes.has("Equity") && equityLinks.length > 0 && (
          <MobileNavItem
            href="#"
            icon={ChartPie}
            active={pathname.startsWith("/equity")}
            onClick={(e) => {
              e.preventDefault();
              toggleDialog("equity");
            }}
          >
            Equity
          </MobileNavItem>
        )}
        <MobileNavItem
          href="#"
          icon={Ellipsis}
          active={pathname.startsWith("/settings")}
          onClick={(e) => {
            e.preventDefault();
            toggleDialog("show_more");
          }}
        >
          More
        </MobileNavItem>
      </nav>
    </>
  );
};

const BottomSheetDialog = ({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <DialogPrimitive.Root open={open}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-gray-100/18" onClick={onClose} />
    <DialogPrimitive.Content
      className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-0 z-[50] rounded-t-2xl bg-white pb-2 data-[state=closed]:duration-300 data-[state=open]:duration-200"
      style={{
        boxShadow: "0px -2px 4px -2px rgba(0,0,0,0.1), 0px -4px 6px -1px rgba(0,0,0,0.1)",
        bottom: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
      }}
    >
      <DialogPrimitive.Title className="px-6 pt-5 pb-3 font-medium">{title}</DialogPrimitive.Title>
      <div className="border-b border-[#dcdcdc]">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Root>
);

const MobileNavItem = ({
  icon: Icon,
  children,
  active,
  badge,
  ...props
}: React.ComponentProps<typeof Link> & {
  active?: boolean;
  icon: React.ComponentType<LucideProps>;
  badge?: number;
}) => (
  <Link
    className={cn(
      "flex h-full flex-1 flex-col items-center justify-center gap-1 transition-opacity",
      active ? "opacity-100" : "opacity-50",
    )}
    {...props}
  >
    <div className="relative">
      <Icon className="size-5" />
      {badge && badge > 0 ? (
        <div className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white bg-blue-600" />
      ) : null}
    </div>
    <span className="text-[10px] leading-4">{children}</span>
  </Link>
);

export default MobileNav;
