import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaxSettingsLoading() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Tax information</h2>
        <p className="text-muted-foreground text-base">These details will be included in your applicable tax forms.</p>
      </hgroup>
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full max-w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="grid items-start gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full max-w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="grid items-start gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-8">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
