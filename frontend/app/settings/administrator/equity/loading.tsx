"use client";
import React from "react";
import SkeletonList from "@/components/SkeletonList";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentCompany } from "@/global";

export default function EquityLoading() {
  const company = useCurrentCompany();

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Equity</h2>
        <p className="text-muted-foreground text-base">
          Manage your company ownership, including cap table, option pools, and grants.
        </p>
      </hgroup>
      <div className="bg-card border-input rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-16 md:w-32" />
            <Skeleton className="h-4 w-36 md:w-64" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      </div>
      {company.equityEnabled ? (
        <div className="grid gap-8">
          <hgroup>
            <Skeleton className="mb-2 h-6 w-32" />
            <Skeleton className="h-4 w-full max-w-72" />
          </hgroup>
          <div className="grid gap-4">
            <SkeletonList>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </SkeletonList>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
