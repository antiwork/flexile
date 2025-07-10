import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsDetailsSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="mb-1 h-7 w-16" />
        <Skeleton className="h-5 w-96" />
      </hgroup>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-2">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <Skeleton className="h-3 w-96" />
      </div>

      <Skeleton className="h-10 w-28" />
    </div>
  );
}
