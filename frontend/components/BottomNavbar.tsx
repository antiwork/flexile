"use client";

import { SignOutButton } from "@clerk/nextjs";
import {
  ChartPie,
  ChevronRight,
  ChevronsUpDown,
  Files,
  LogOut,
  MoreHorizontal,
  ReceiptIcon,
  Rss,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import defaultCompanyLogo from "@/images/default-company-logo.svg";
import { cn } from "@/utils";
import { useNavData } from "@/utils/use-navdata";

type MoreSection =
  | {
      type: "link";
      label: string;
      href: string;
      icon: React.ReactNode;
      hasChevron: boolean;
    }
  | {
      type: "logout";
      label: string;
      icon: React.ReactNode;
      hasChevron: boolean;
      action: () => void;
    };

export default function BottomNavbar() {
  const [openModal, setOpenModal] = React.useState<"equity" | "more" | null>(null);
  const sidebar = useSidebar();
  const { user, updatesPath, equityLinks, switchCompany } = useNavData();

  const moreSections: MoreSection[] = [
    ...(updatesPath
      ? [
          {
            type: "link" as const,
            label: "Updates",
            href: "/updates/company",
            icon: <Rss className="mr-3 size-5" />,
            hasChevron: true,
          },
        ]
      : []),
    {
      type: "link",
      label: "Settings",
      href: "/settings",
      icon: <Settings className="mr-3 size-5" />,
      hasChevron: true,
    },
    {
      type: "logout",
      label: "Log out",
      icon: <LogOut className="mr-3 size-5" />,
      hasChevron: false,
      action: () => (window.location.href = "/sign-out"),
    },
  ];

  const equityModalSections = equityLinks.map((link) => ({
    label: link.label,
    href: link.route,
  }));

  return (
    <>
      <Dialog
        open={openModal !== null}
        onOpenChange={(open) => {
          if (!open) setOpenModal(null);
        }}
      >
        <DialogContent
          className={cn(
            "fixed !top-auto left-1/2 mx-auto !mt-0 w-full max-w-md -translate-x-1/2 !translate-y-0 !transform-none rounded-t-2xl rounded-b-none bg-white p-0",
            "border-none shadow-[0px_-2px_24px_rgba(0,0,0,0.11)]",
          )}
          style={{ bottom: "64px", zIndex: 100 }}
        >
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold">
              {openModal === "equity" ? "Equity" : openModal === "more" ? "More" : ""}
            </DialogTitle>
          </DialogHeader>
          {openModal === "equity" && (
            <ul className="flex flex-col px-2 pb-3">
              {equityModalSections.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="flex w-full items-center rounded-t-lg px-4 py-3 text-base transition-colors hover:bg-gray-100"
                    onClick={() => setOpenModal(null)}
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="ml-auto size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {openModal === "more" && (
            <ul className="flex flex-col px-2 pb-3">
              {user.companies.length > 1 ? (
                <li className="px-2 pt-2 pb-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex w-full items-center rounded-lg px-2 py-2 text-base font-semibold transition-colors hover:bg-gray-100 focus:outline-none"
                        aria-label="Switch company"
                      >
                        <CompanyName />
                        <ChevronsUpDown className="ml-auto h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                      {user.companies.map((company) => (
                        <DropdownMenuItem
                          key={company.id}
                          onSelect={() => {
                            if (user.currentCompanyId !== company.id) void switchCompany(company.id);
                            setOpenModal(null);
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
                </li>
              ) : (
                <li className="px-2 pt-2 pb-1">
                  <div className="flex items-center gap-2">
                    <CompanyName />
                  </div>
                </li>
              )}
              {moreSections.map((item) => {
                if (item.type === "logout") {
                  return (
                    <li key={item.label}>
                      <SignOutButton>
                        <button
                          className="flex w-full items-center rounded-t-lg px-4 py-3 text-base transition-colors hover:bg-gray-100"
                          onClick={() => setOpenModal(null)}
                          type="button"
                          style={{ background: "none", border: 0 }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      </SignOutButton>
                    </li>
                  );
                }
                return (
                  <li key={item.label}>
                    <Link
                      href={{ pathname: item.href }}
                      className="flex w-full items-center rounded-t-lg px-4 py-3 text-base transition-colors hover:bg-gray-100"
                      onClick={() => {
                        setOpenModal(null);
                        sidebar.setOpenMobile(false);
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.hasChevron ? <ChevronRight className="ml-auto size-4" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogClose asChild className="absolute top-2 right-4 rounded-full p-2 hover:bg-gray-200"></DialogClose>
        </DialogContent>
      </Dialog>

      <nav className="fixed right-0 bottom-0 left-0 z-100 border-t border-gray-200 bg-white shadow-lg md:hidden">
        <MobileNavLinks
          onEquityClick={() => setOpenModal("equity")}
          onMoreClick={() => setOpenModal("more")}
          openModal={openModal}
        />
      </nav>
    </>
  );
}

const CompanyName = () => {
  const { company } = useNavData();
  return (
    <>
      {company.name ? (
        <Link href="/settings" className="relative size-6">
          <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm" alt="" />
        </Link>
      ) : null}
      <div>
        <span className="line-clamp-1 text-sm font-bold" title={company.name ?? ""}>
          {company.name}
        </span>
      </div>
    </>
  );
};

export const MobileNavLinks = ({
  onEquityClick,
  onMoreClick,
  openModal,
}: {
  onEquityClick: () => void;
  onMoreClick: () => void;
  openModal: "equity" | "more" | null;
}) => {
  const { pathname, routes, invoicesData, isInvoiceActionable, equityLinks } = useNavData();
  const sidebar = useSidebar();
  const showInvoicesDot = (invoicesData?.filter(isInvoiceActionable).length ?? 0) > 0;

  return (
    <ul className="flex h-16 items-center justify-between px-2">
      {routes.has("Invoices") && (
        <MobileNavItem
          href="/invoices"
          icon={
            <ReceiptIcon
              className={cn(
                "mb-1 size-6",
                openModal === null && pathname.startsWith("/invoices") ? "text-black" : "text-gray-400",
              )}
            />
          }
          label="Invoices"
          active={openModal === null && pathname.startsWith("/invoices")}
          showDot={showInvoicesDot}
          onClick={() => sidebar.setOpenMobile(false)}
        />
      )}
      {routes.has("Documents") && (
        <MobileNavItem
          href="/documents"
          icon={
            <Files
              className={cn(
                "mb-1 size-6",
                openModal === null && pathname.startsWith("/documents") ? "text-black" : "text-gray-400",
              )}
            />
          }
          label="Documents"
          active={openModal === null && pathname.startsWith("/documents")}
          onClick={() => sidebar.setOpenMobile(false)}
        />
      )}
      {routes.has("People") && (
        <MobileNavItem
          href="/people"
          icon={
            <Users
              className={cn(
                "mb-1 size-6",
                openModal === null && pathname.startsWith("/people") ? "text-black" : "text-gray-400",
              )}
            />
          }
          label="People"
          active={openModal === null && pathname.startsWith("/people")}
          onClick={() => sidebar.setOpenMobile(false)}
        />
      )}

      {routes.has("Equity") && equityLinks.length > 0 && (
        <MobileNavItem
          icon={
            <ChartPie
              className={cn("mb-1 size-6", openModal === "equity" ? "font-bold text-black" : "text-gray-400")}
            />
          }
          label="Equity"
          active={openModal === "equity"}
          onClick={onEquityClick}
          asButton
        />
      )}
      <MobileNavItem
        icon={
          <MoreHorizontal
            className={cn("mb-1 size-6", openModal === "more" ? "font-bold text-black" : "text-gray-400")}
          />
        }
        label="More"
        active={openModal === "more"}
        onClick={onMoreClick}
        asButton
      />
    </ul>
  );
};

const MobileNavItem = ({
  href,
  icon,
  label,
  active,
  showDot,
  onClick,
  asButton = false,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  showDot?: boolean;
  onClick: () => void;
  asButton?: boolean;
}) => {
  const content = (
    <>
      <div className="relative flex flex-col items-center">
        {icon}
        {showDot ? (
          <span className="absolute -top-2 left-4 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
        ) : null}
      </div>
      <span className={active ? "font-semibold text-black" : "text-gray-400"}>{label}</span>
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
