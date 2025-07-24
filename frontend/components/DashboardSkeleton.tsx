import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-10">
      {/* Earnings Card Skeleton */}
      <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
        <CardHeader className="pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16 md:h-5 md:w-20" />
            <Skeleton className="h-4 w-4 rounded md:h-5 md:w-5" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 md:space-y-3">
            <div className="mb-2 flex items-center gap-2 md:mb-3">
              <Skeleton className="h-6 w-16 rounded-full md:h-7 md:w-20" />
            </div>
            <Skeleton className="h-6 w-24 md:h-8 md:w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 md:h-4 md:w-20" />
              <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equity Card Skeleton */}
      <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
        <CardHeader className="pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16 md:h-5 md:w-20" />
            <Skeleton className="h-4 w-4 rounded md:h-5 md:w-5" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 md:space-y-3">
            <div className="mb-2 flex items-center gap-2 md:mb-3">
              <Skeleton className="h-6 w-20 rounded-full md:h-7 md:w-24" />
            </div>
            <Skeleton className="h-6 w-16 md:h-8 md:w-20" />
            <Skeleton className="h-3 w-20 md:h-4 md:w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Activity Card Skeleton */}
      <Card className="border-border bg-card border p-6 shadow-sm md:p-7">
        <CardHeader className="pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16 md:h-5 md:w-20" />
            <Skeleton className="h-4 w-4 rounded md:h-5 md:w-5" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 md:space-y-3">
            <div className="mb-2 flex items-center gap-2 md:mb-3">
              <Skeleton className="h-6 w-20 rounded-full md:h-7 md:w-24" />
            </div>
            <Skeleton className="h-6 w-16 md:h-8 md:w-20" />
            <Skeleton className="h-3 w-24 md:h-4 md:w-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
