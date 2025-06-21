import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function QuickInvoiceSkeleton() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="grid gap-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>

          <Separator orientation="horizontal" className="block w-full lg:hidden" />
          <Separator orientation="vertical" className="hidden lg:block" />

          <div className="grid gap-2">
            <div className="space-y-2">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Separator className="m-0" />
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Separator className="m-0" />
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Separator className="m-0" />
            </div>

            <div className="mt-2 mb-2 pt-2 text-right lg:mt-16 lg:mb-3 lg:pt-0">
              <Skeleton className="mb-2 ml-auto h-4 w-20" />
              <Skeleton className="mb-1 ml-auto h-9 w-24" />
              <Skeleton className="ml-auto h-4 w-32" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
