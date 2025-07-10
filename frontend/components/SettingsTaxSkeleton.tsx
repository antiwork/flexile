import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsTaxSkeleton() {
  return (
    <div className="grid gap-8">
      {/* Header section */}
      <hgroup>
        <Skeleton className="mb-1 h-7 w-40" />
        <Skeleton className="h-5 w-96" />
      </hgroup>

      {/* Form content */}
      <div className="grid gap-4">
        {/* Alert banner */}
        <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        </div>

        {/* Full legal name */}
        <div>
          <Skeleton className="mb-2 h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Country of citizenship */}
        <div>
          <Skeleton className="mb-2 h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Type of entity (Radio buttons) */}
        <div>
          <Skeleton className="mb-2 h-4 w-28" />
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>

        {/* Business entity fields (conditional) */}
        <div className="grid auto-cols-fr grid-flow-col items-start gap-3">
          <div>
            <Skeleton className="mb-2 h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Country of residence/incorporation */}
        <div>
          <Skeleton className="mb-2 h-4 w-48" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Tax ID and Birth Date row */}
        <div className="grid items-start gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex">
              <Skeleton className="h-10 w-full rounded-r-none border-r-0" />
              <Skeleton className="h-10 w-10 rounded-l-none" />
            </div>
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Street address */}
        <div>
          <Skeleton className="mb-2 h-4 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* City */}
        <div>
          <Skeleton className="mb-2 h-4 w-8" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* State and ZIP code row */}
        <div className="grid items-start gap-3 md:grid-cols-2">
          <div>
            <Skeleton className="mb-2 h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>

      {/* Action buttons and disclaimer */}
      <div className="flex flex-wrap gap-8">
        <Skeleton className="h-10 w-28" />
        <div className="flex items-center">
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    </div>
  );
}