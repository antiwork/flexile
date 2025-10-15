import { Skeleton } from "@/components/ui/skeleton";

export default function CompanyDetailsLoading() {
  return (
    <div>
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Details</h2>
        <p className="text-muted-foreground text-base">
          These details will be included in tax forms, as well as in your contractor's invoices.
        </p>
      </hgroup>
      <div className="mt-10 grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full max-w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="my-4 grid grid-rows-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full max-w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-10 w-28" />
    </div>
  );
}
