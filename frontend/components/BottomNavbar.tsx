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

type NavTab = {
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  showDot?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  modal?: boolean;
};

export default function BottomNavbar() {
  const [equitySheet, setEquitySheet] = React.useState(false);
  const sidebar = useSidebar();
  const {
    user,
    company,
    pathname,
    routes,
    invoicesData,
    isInvoiceActionable,
    updatesPath,
    equityLinks,
    isOpen,
    setIsOpen,
  } = useNavData();

  const showInvoicesDot = (invoicesData?.filter(isInvoiceActionable).length ?? 0) > 0;

  const navTabs: (NavTab | false)[] = [
    routes.has("Invoices") && {
      label: "Invoices",
      href: "/invoices",
      icon: (
        <ReceiptIcon className={cn("mb-1 size-6", pathname.startsWith("/invoices") ? "text-black" : "text-gray-400")} />
      ),
      active: pathname.startsWith("/invoices"),
      showDot: showInvoicesDot,
    },
    routes.has("Documents") && {
      label: "Documents",
      href: "/documents",
      icon: (
        <Files
          className={cn(
            "mb-1 size-6",
            pathname.startsWith("/documents") ? "stroke-[2.5] text-black" : "stroke-[1.25] text-gray-400",
          )}
        />
      ),
      active: pathname.startsWith("/documents"),
    },
    routes.has("People") && {
      label: "People",
      href: "/people",
      icon: <Users className={cn("mb-1 size-6", pathname.startsWith("/people") ? "text-black" : "text-gray-400")} />,
      active: pathname.startsWith("/people"),
    },
    routes.has("Equity") &&
      equityLinks.length > 0 && {
        label: "Equity",
        href: "#",
        icon: (
          <ChartPie
            className={cn(
              "mb-1 size-6",
              pathname.startsWith("/equity") || equitySheet ? "text-black" : "text-gray-400",
            )}
          />
        ),
        active: pathname.startsWith("/equity") || equitySheet,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          setEquitySheet(true);
        },
      },
    {
      label: "More",
      href: "#",
      icon: <MoreHorizontal className={cn("mb-1 size-6", isOpen ? "text-black" : "text-gray-400")} />,
      active: isOpen,
      modal: true,
    },
  ];

  function isNavTab(tab: unknown): tab is NavTab {
    return !!tab;
  }
  const filteredNavTabs = navTabs.filter(isNavTab);

  const companySection = {
    label: company.name,
    icon: (
      <span className="relative mr-3 size-6">
        <Image src={company.logo_url || defaultCompanyLogo} fill className="rounded-sm object-contain" alt="" />
      </span>
    ),
    hasChevron: (user?.companies?.length ?? 0) > 1,
    onClick: undefined,
  };

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
      <Dialog open={equitySheet} onOpenChange={setEquitySheet}>
        <DialogContent
          className={cn(
            "fixed !top-auto left-1/2 mx-auto !mt-0 w-full max-w-md -translate-x-1/2 !translate-y-0 !transform-none rounded-t-2xl rounded-b-none bg-white p-0",
            "border-none shadow-[0px_-2px_24px_rgba(0,0,0,0.11)]",
          )}
          style={{
            bottom: "64px",
            zIndex: 100,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold">Equity</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col px-2 pb-3">
            {equityModalSections.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="flex w-full items-center rounded-t-lg px-4 py-3 text-base transition-colors hover:bg-gray-100"
                  onClick={() => setEquitySheet(false)}
                >
                  <span>{link.label}</span>
                  <ChevronRight className="ml-auto size-4" />
                </Link>
              </li>
            ))}
          </ul>
          <DialogClose asChild className="absolute top-2 right-4 rounded-full p-2 hover:bg-gray-200"></DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn(
            "fixed !top-auto left-1/2 mx-auto !mt-0 w-full max-w-md -translate-x-1/2 !translate-y-0 !transform-none rounded-t-2xl rounded-b-none bg-white p-0",
            "border-none shadow-[0px_-2px_24px_rgba(0,0,0,0.11)]",
          )}
          style={{
            bottom: "64px",
            zIndex: 100,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold">More</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col px-2 pb-3">
            <li>
              <button
                className="flex w-full items-center rounded-t-lg px-4 py-3 text-base font-semibold transition-colors hover:bg-gray-100"
                onClick={companySection.onClick}
                style={{ background: "none", border: 0 }}
                tabIndex={0}
              >
                {companySection.icon}
                <span>{companySection.label}</span>
                {companySection.hasChevron ? <ChevronsUpDown className="ml-auto size-4" /> : null}
              </button>
            </li>
            {moreSections.map((item) => {
              if (item.type === "logout") {
                return (
                  <li key={item.label}>
                    <SignOutButton>
                      <button
                        className="flex w-full items-center rounded-t-lg px-4 py-3 text-base transition-colors hover:bg-gray-100"
                        onClick={() => setIsOpen(false)}
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
                      setIsOpen(false);
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
        </DialogContent>
      </Dialog>

      <nav className="fixed right-0 bottom-0 left-0 z-100 border-t border-gray-200 bg-white shadow-lg md:hidden">
        <ul className="flex h-16 items-center justify-between px-2">
          {filteredNavTabs.map((tab) => (
            <li key={tab.label} className="mx-1 flex flex-1 justify-center">
              {tab.label === "Equity" ? (
                <button
                  className="flex flex-col items-center pt-1 text-xs text-gray-500 hover:text-black focus:outline-none"
                  aria-label="Open equity menu"
                  onClick={tab.onClick}
                  type="button"
                >
                  <ChartPie className={cn("mb-1 size-6", tab.active ? "text-black" : "text-gray-400")} />
                  <span className={tab.active ? "font-semibold text-black" : "text-gray-400"}>Equity</span>
                </button>
              ) : tab.modal ? (
                <button
                  className="flex flex-col items-center pt-1 text-xs text-gray-500 hover:text-black"
                  aria-label="Open more menu"
                  onClick={() => setIsOpen(true)}
                  type="button"
                >
                  {tab.icon}
                  <span className="text-xs">More</span>
                </button>
              ) : (
                <Link
                  href={{ pathname: tab.href }}
                  className="flex flex-col items-center pt-1 text-xs"
                  aria-current={tab.active ? "page" : undefined}
                  onClick={() => sidebar.setOpenMobile(false)}
                >
                  <div className="relative flex flex-col items-center">
                    {tab.icon}
                    {tab.showDot ? (
                      <span className="absolute -top-2 left-4 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                    ) : null}
                  </div>
                  <span className={tab.active ? "font-semibold text-black" : "text-gray-400"}>{tab.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
