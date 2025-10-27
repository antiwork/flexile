import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BankAccountsSectionLoading() {
  return (
    <div className="grid gap-8 sm:gap-12 lg:gap-16">
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-bold">Payout method</div>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardContent className="flex flex-row items-center justify-between gap-4 p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40 sm:w-48" />
                  <Skeleton className="h-4 w-28 sm:w-32" />
                </div>
              </div>
              <Skeleton className="h-9 w-14" />
            </CardContent>
          </Card>
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

export function DividendSectionLoading() {
  return (
    <div className="grid gap-4">
      <h2 className="font-bold">Dividends</h2>
      <div className="flex flex-col gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-full max-w-xs sm:max-w-sm lg:w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-20 sm:w-24" />
      </div>
    </div>
  );
}
