import Link from "next/link";
import React, { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/utils";
import { useCurrentCompany } from "@/global";
import type { Route } from "next";

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
  add_bank_account: "/settings/payouts",
  invite_contractor: "/people",
  send_first_payment: "/invoices",
} as const;

const getItemHref = (key: string): Route => CHECKLIST_ROUTES[key] || "/";

export const GettingStarted = () => {
  const company = useCurrentCompany();
  const [isExpanded, setIsExpanded] = useState(false);

  if (company.checklistCompletionPercentage === 100) {
    return null;
  }

  const progressPercentage = company.checklistCompletionPercentage;

  return (
    <SidebarMenuItem className="border-t border-gray-200">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="flex flex-col-reverse">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="cursor-pointer">
            <CircularProgress progress={progressPercentage} />
            <span>Getting started</span>
            <span className="ml-auto text-gray-500">{progressPercentage}%</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="absolute mb-10 w-full overflow-hidden">
          <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="space-y-3 p-4">
              {company.checklistItems.map((item) => (
                <div key={item.key} className="flex items-center space-x-1 text-sm">
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      item.completed ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white",
                    )}
                  >
                    {item.completed ? <CheckIcon /> : null}
                  </div>
                  {!item.completed ? (
                    <Link href={getItemHref(item.key)} className="text-gray-900 hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="text-gray-400 line-through">{item.title}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
};
