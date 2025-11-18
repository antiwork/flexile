import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentCompany, useCurrentUser } from "@/global";

export function PayoutsPageLoading() {
  const user = useCurrentUser();
  const company = useCurrentCompany();

  return (
    <>
      <div className="grid gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-bold">Payout method</div>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
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
        <Skeleton className="h-9 w-43" />
      </div>
      {user.roles.worker && company.equityEnabled ? (
        <div className="grid gap-4">
          <div className="text-base font-bold">Equity</div>
          <div className="grid">
            <div className="grid gap-2">
              <p>How much of your rate would you like to swap for equity?</p>
              <div className="flex flex-row items-center gap-2">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
            <div className="py-6">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-6 w-17" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Separator />
              <div className="flex justify-between gap-2">
                <Skeleton className="h-6 w-17" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Separator />
              <div className="flex justify-between gap-2">
                <Skeleton className="h-6 w-17" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      ) : null}
      {user.roles.investor ? (
        <div className="grid gap-4">
          <h2 className="font-bold">Dividends</h2>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Skeleton className="my-1 h-4 w-1/4" />
              <Skeleton className="h-9 w-full" />
              <div className="grid gap-1 py-1">
                <Skeleton className="h-3 w-[95%]" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ModalLoading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="my-1 h-4 w-28" />
        <div className="grid grid-cols-3 grid-rows-1 gap-1">
          <Skeleton className="h-8.5 w-full" />
          <Skeleton className="h-8.5 w-full" />
          <Skeleton className="h-8.5 w-full" />
        </div>
      </div>
      <div className="grid gap-2">
        <Skeleton className="my-1 h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Skeleton className="my-1 h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="my-1 h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="grid gap-2">
        <Skeleton className="my-1 h-4 w-32" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid gap-2">
        <Skeleton className="my-1 h-4 w-32" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Skeleton className="my-1 h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="my-1 h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="my-1 h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="grid gap-2">
        <Skeleton className="my-1 h-4 w-32" />
        <Skeleton className="h-9 w-full" />
      </div>
    </>
  );
}
