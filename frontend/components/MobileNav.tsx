import { SignOutButton } from "@clerk/nextjs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { skipToken } from "@tanstack/react-query";
import { capitalize } from "lodash-es";
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
import { companyLinks, personalLinks } from "@/app/settings";
import { CompanyName } from "@/components/CompanyName";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { switchCompany } from "@/lib/switch-company";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import defaultCompanyLogo from "../images/default-company-logo.svg";

const NAV_HEIGHT_PX = 49;
type DialogType = "equity" | "show_more" | null;
type SubmenuType = "organizations" | "settings" | null;

const MobileNav = () => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [dialog, setDialog] = useState<DialogType>(null);
  const [submenu, setSubmenu] = useState<SubmenuType>(null);
  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const filteredPersonalLinks = personalLinks.filter((link) => link.isVisible(user));
  const filteredCompanyLinks = companyLinks.filter((link) => link.isVisible(user));

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
    if (dialogType === null) {
      setDialog(null);
      // Hide submenu when dialog close animation finishes
      if (submenu) {
        setTimeout(() => {
          setSubmenu(null);
        }, 300);
      }
    } else {
      if (dialogType === dialog) return toggleDialog(null);
      setDialog(dialogType);
    }
  };

  const renderEquityDialog = () => (
    <BottomSheetDialog open={dialog === "equity"} title="Equity" onClose={() => toggleDialog(null)}>
      {equityLinks.map((item, index) => (
        <Link
          key={index}
          href={item.route}
          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
          onClick={() => {
            toggleDialog(null);
          }}
        >
          <span>{item.label}</span>
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </Link>
      ))}
    </BottomSheetDialog>
  );
  const renderShowMoreDialog = () => (
    <BottomSheetDialog
      open={dialog === "show_more"}
      title={submenu ? capitalize(submenu) : "More"}
      onClose={() => {
        toggleDialog(null);
      }}
      submenu={!!submenu}
      onGoBack={() => {
        setSubmenu(null);
      }}
    >
      <div key={submenu || "main"} className="animate-fadeIn relative transition-opacity duration-300">
        {/* MAIN MENU */}
        {submenu === null && (
          <>
            {user.companies.length > 1 ? (
              <button
                onClick={() => setSubmenu("organizations")}
                className="flex w-full cursor-pointer items-center gap-2 px-6 py-4 hover:bg-gray-50"
              >
                <CompanyName />
                <ChevronsUpDown className="ml-auto h-4 w-4 text-gray-600" />
              </button>
            ) : user.companies[0]?.name ? (
              <div className="flex items-center gap-2 px-6 py-4">
                <CompanyName />
              </div>
            ) : null}

            {updatesPath ? (
              <Link
                href="/updates/company"
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                onClick={() => toggleDialog(null)}
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

            <button
              className="flex w-full cursor-pointer items-center justify-between px-6 py-4 hover:bg-gray-50"
              onClick={() => setSubmenu("settings")}
            >
              <div className="flex gap-2">
                <div className="flex h-6 w-6 items-center justify-center">
                  <Settings className="h-4 w-4" />
                </div>
                <span>Settings</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>

            <SignOutButton>
              <Link
                href="#"
                className="flex items-center px-6 py-4 hover:bg-gray-50"
                onClick={() => toggleDialog(null)}
              >
                <div className="flex gap-2">
                  <div className="flex h-6 w-6 items-center justify-center">
                    <LogOut className="size-4" />
                  </div>
                  <span>Log out</span>
                </div>
              </Link>
            </SignOutButton>
          </>
        )}

        {/* SETTINGS SUBMENU */}
        {submenu === "settings" && (
          <>
            {filteredCompanyLinks.length ? (
              <div className="flex h-9 items-center px-4.5 text-sm text-gray-600">Personal</div>
            ) : null}
            {filteredPersonalLinks.map((link) => (
              <Link
                key={link.route}
                href={link.route}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                onClick={() => toggleDialog(null)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center">
                    <link.icon className="size-4" />
                  </div>
                  <span>{link.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </Link>
            ))}
            {filteredCompanyLinks.length ? (
              <>
                <div className="my-4 h-px bg-[#dcdcdc]"></div>
                <div className="flex h-9 items-center px-4.5 text-sm text-gray-600">Company</div>
              </>
            ) : null}

            {filteredCompanyLinks.map((link) => (
              <Link
                href={link.route}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                onClick={() => toggleDialog(null)}
                key={link.route}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center">
                    <link.icon className="size-4" />
                  </div>
                  <span>{link.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </Link>
            ))}
          </>
        )}

        {/* ORGANIZATIONS SUBMENU */}
        {submenu === "organizations" && (
          <>
            {user.companies.map((company) => (
              <button
                key={company.id}
                onClick={() => {
                  if (user.currentCompanyId !== company.id) switchCompany(company.id);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-6 py-4 hover:bg-gray-50"
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
              </button>
            ))}
          </>
        )}
      </div>
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
  submenu,
  onGoBack,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  submenu?: boolean;
  onGoBack?: () => void;
}) => (
  <DialogPrimitive.Root open={open}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-gray-100/18" onClick={onClose} />
    <DialogPrimitive.Content
      className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-0 z-[50] flex max-h-[75vh] flex-col rounded-t-2xl bg-white pb-2 data-[state=closed]:duration-300 data-[state=open]:duration-200"
      style={{
        boxShadow: "0px -2px 4px -2px rgba(0,0,0,0.1), 0px -4px 6px -1px rgba(0,0,0,0.1)",
        bottom: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="flex shrink-0 gap-2.5 px-6 pt-5 pb-3" onClick={onGoBack}>
        {submenu ? (
          <div className="flex size-6 items-center justify-center">
            <ChevronRight className="size-4 rotate-180" />
          </div>
        ) : null}
        <DialogPrimitive.Title className="font-medium">{title}</DialogPrimitive.Title>
      </div>
      <div className="flex-1 overflow-y-auto border-b border-[#dcdcdc]">{children}</div>
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
