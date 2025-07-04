import { Skeleton } from "@/components/ui/skeleton";

export default function BankAccountCardSkeleton() {
  return (
    <div className="rounded-md border-gray-400 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-5 w-40 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-8 w-16 rounded" />
      </div>
    </div>
  );
}
