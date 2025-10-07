import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaxSettingsLoading() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="mb-1 h-9 w-full max-w-64" />
        <Skeleton className="h-5 w-full max-w-96" />
      </hgroup>
      <div className="grid gap-4">
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
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
