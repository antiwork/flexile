import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsDetailsSkeleton() {
  return (
    <div className="grid gap-8">
      {/* Header section */}
      <hgroup>
        <Skeleton className="mb-1 h-7 w-16" />
        <Skeleton className="h-5 w-96" />
      </hgroup>

      {/* Form fields */}
      <div className="grid gap-4">
        {/* Company's legal name */}
        <div>
          <Skeleton className="mb-2 h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* EIN */}
        <div>
          <Skeleton className="mb-2 h-4 w-8" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Phone number */}
        <div>
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Street address */}
        <div>
          <Skeleton className="mb-2 h-4 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* City, State, ZIP row */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Disclaimer text */}
        <Skeleton className="h-3 w-96" />
      </div>

      {/* Submit button */}
      <Skeleton className="h-10 w-28" />
    </div>
  );
}