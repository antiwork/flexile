import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { ChevronDown, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import CircularProgress from "@/components/CircularProgress";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { storageKeys } from "@/models/constants";
import { cn } from "@/utils";

const CheckIcon = () => (
  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const CHECKLIST_ROUTES: Record<string, Route> = {
  add_bank_account: "/settings/administrator/billing",
  invite_contractor: "/people",
  send_first_payment: "/invoices",
  fill_tax_information: "/settings/tax",
  add_payout_information: "/settings/payouts",
  sign_contract: "/documents",
  add_company_details: "/settings/administrator/details",
} as const;

const getItemHref = (key: string): Route => CHECKLIST_ROUTES[key] || "/";

type Status = "expanded" | "dismissed" | "collapsed" | "completed";

const isValidStatus = (status: string | null): status is Status =>
  status !== null && ["expanded", "dismissed", "collapsed", "completed"].includes(status);

export const GettingStarted = () => {
  const company = useCurrentCompany();
  const user = useCurrentUser();

  const router = useRouter();
  const pathname = usePathname();

  const progressPercentage = company.checklistCompletionPercentage;

  const [status, setStatus] = useState<Status>(() => {
    const savedStatus = localStorage.getItem(storageKeys.GETTING_STARTED_STATUS);
    if (!savedStatus && progressPercentage === 100) {
      return "dismissed";
    }
    if (savedStatus === "completed" && progressPercentage < 100) {
      return "expanded";
    }
    return isValidStatus(savedStatus) ? savedStatus : "expanded";
  });

  useEffect(() => {
    if (status === "dismissed") return;
    if (company.checklistCompletionPercentage === 100) {
      setStatus("completed");
    }
  }, [company, status]);

  useEffect(() => {
    if (status === "dismissed") {
      localStorage.removeItem(storageKeys.GETTING_STARTED_STATUS);
    } else {
      localStorage.setItem(storageKeys.GETTING_STARTED_STATUS, status);
    }
  }, [status]);

  if (status === "dismissed") {
    return null;
  }

  if (!company.checklistItems.length) {
    return null;
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        open={status === "expanded" || status === "completed"}
        onOpenChange={(expanded) => setStatus(expanded ? "expanded" : "collapsed")}
        className="flex h-full flex-col-reverse"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="items-center justify-between">
            {status === "completed" ? (
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500">
                <CheckIcon />
              </div>
            ) : (
              <CircularProgress progress={progressPercentage} />
            )}
            <span>Getting started</span>
            <span className="ml-auto text-gray-500">{progressPercentage}%</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 absolute mb-8 w-full origin-bottom overflow-hidden py-3 data-[state=closed]:duration-300 data-[state=open]:duration-200">
          {status === "completed" ? (
            <div className="rounded-lg border border-gray-200 bg-white pb-4 shadow-sm">
              <div className="mr-3 ml-4 flex h-11 items-center justify-between">
                <span className="font-medium">You are all set!</span>
                <button
                  onClick={() => setStatus("dismissed")}
                  className="ml-4 cursor-pointer transition-colors hover:text-black/80"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <div className="mx-4">
                <p className="text-sm">
                  {user.roles.worker
                    ? "You are ready to send your first invoice."
                    : "Everything is in place. Time to flex."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white px-1 pb-4 shadow-sm">
              <CollapsibleTrigger asChild>
                <div className="mx-3 flex h-11 cursor-pointer items-center justify-between">
                  <span className="font-medium">Getting started</span>
                  <ChevronDown className={cn("h-4 w-4")} />
                </div>
              </CollapsibleTrigger>
              <div className="space-y-1">
                {company.checklistItems.map((item) => (
                  <SidebarMenuButton
                    key={item.key}
                    className="flex h-8 items-center space-x-1 text-sm"
                    onClick={() => {
                      if (!item.completed && pathname !== getItemHref(item.key)) {
                        router.push(getItemHref(item.key));
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border",
                        item.completed ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white",
                      )}
                    >
                      {item.completed ? <CheckIcon /> : null}
                    </div>
                    {!item.completed ? (
                      <span className="text-left">{item.title}</span>
                    ) : (
                      <span className="text-gray-400 line-through">{item.title}</span>
                    )}
                  </SidebarMenuButton>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};
