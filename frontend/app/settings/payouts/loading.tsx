import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayoutsLoading() {
  return (
    <>
      <Skeleton className="mb-8 h-9 w-32 sm:w-40" />
      <div className="grid gap-8 sm:gap-12 lg:gap-16">
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-6 w-32 sm:w-40" />
            <Skeleton className="h-10 w-full sm:w-32" />
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40 sm:w-48" />
                      <Skeleton className="h-4 w-28 sm:w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-20 self-end sm:self-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-6 w-20 sm:w-24" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-full max-w-xs sm:max-w-md lg:w-80" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-4 py-4 sm:py-6">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-5 w-24 sm:w-32" />
                <Skeleton className="h-5 w-20 sm:w-24" />
              </div>
              <div className="flex justify-between gap-2">
                <Skeleton className="h-5 w-24 sm:w-32" />
                <Skeleton className="h-5 w-20 sm:w-24" />
              </div>
            </div>
            <Separator />
            <div className="flex justify-between gap-2 py-2">
              <Skeleton className="h-6 w-24 sm:w-28" />
              <Skeleton className="h-6 w-24 sm:w-28" />
            </div>
            <Skeleton className="mt-4 h-10 w-20 sm:w-24" />
          </div>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-6 w-28 sm:w-32" />
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-full max-w-xs sm:max-w-sm lg:w-64" />
                <Skeleton className="h-10 w-full max-w-xs" />
              </div>
              <Skeleton className="h-10 w-20 sm:w-24" />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
