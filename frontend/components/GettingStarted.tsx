import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/utils";
import { useCurrentCompany, useUserStore } from "@/global";
import type { Route } from "next";
import { ChevronDown, X } from "lucide-react";

const CircularProgress = ({ progress }: { progress: number }) => {
  const circumference = 50.27; // 2π * radius (radius = 8)
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`;

  return (
    <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" className="text-gray-300" />
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray={strokeDasharray}
        className="text-blue-500"
      />
    </svg>
  );
};

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
  add_bank_account: "/administrator/settings/billing",
  invite_contractor: "/people",
  send_first_payment: "/invoices",
} as const;

const getItemHref = (key: string): Route => CHECKLIST_ROUTES[key] || "/";

export const GettingStarted = () => {
  const company = useCurrentCompany();
  const progressPercentage = company.checklistCompletionPercentage;

  const [status, setStatus] = useState<"expanded" | "dismissed" | "collapsed" | "completed">(
    progressPercentage === 100 ? "dismissed" : "collapsed",
  );

  if (status === "dismissed") {
    return null;
  }

  useEffect(() => {
    const subscription = useUserStore.subscribe((state, prev) => {
      const currentPercentage =
        state.user?.companies.find((c) => c.id === company.id)?.checklistCompletionPercentage || 0;
      if (currentPercentage === 100) {
        const previousPercentage =
          prev.user?.companies.find((c) => c.id === company.id)?.checklistCompletionPercentage || 0;
        if (previousPercentage < 100) {
          setStatus("completed");
        }
      }
    });
    return subscription;
  }, []);

  return (
    <SidebarMenuItem className="border-t border-gray-200">
      <Collapsible
        open={status === "expanded" || status === "completed"}
        onOpenChange={(expanded) => setStatus(expanded ? "expanded" : "collapsed")}
        className="flex flex-col-reverse"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className="cursor-pointer transition-colors duration-200 hover:bg-gray-50"
            closeOnMobileClick={false}
          >
            {status === "completed" ? (
              <div className="h-4 w-4 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500">
                <CheckIcon />
              </div>
            ) : (
              <CircularProgress progress={progressPercentage} />
            )}
            <span>Getting started</span>
            <span className="ml-auto text-gray-500">{progressPercentage}%</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 absolute mb-10 w-full overflow-hidden data-[state=closed]:duration-300 data-[state=open]:duration-200">
          {status === "completed" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">You are all set!</h3>
                  <p className="mt-1 text-sm text-gray-600">Everything is in place. Time to flex.</p>
                </div>
                <button
                  onClick={() => setStatus("dismissed")}
                  className="ml-4 text-gray-400 transition-colors hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm">
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer items-center justify-between p-4 transition-colors duration-200 hover:bg-gray-50">
                  <span className="font-medium text-gray-900">Getting started</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-gray-500 transition-transform duration-300 ease-in-out",
                      status !== "expanded" && "rotate-180",
                    )}
                  />
                </div>
              </CollapsibleTrigger>
              <div className="space-y-3 p-4">
                {company.checklistItems.map((item) => (
                  <div key={item.key} className="flex items-center space-x-1 text-sm">
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors duration-200",
                        item.completed ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white",
                      )}
                    >
                      {item.completed ? <CheckIcon /> : null}
                    </div>
                    {!item.completed ? (
                      <Link
                        href={getItemHref(item.key)}
                        className="text-gray-900 transition-colors duration-200 hover:text-blue-600 hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <span className="text-gray-400 line-through">{item.title}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};
