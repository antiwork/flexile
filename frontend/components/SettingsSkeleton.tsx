import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function SettingsProfileSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="mb-4 h-7 w-16" />
      <div className="grid gap-4">
        <div>
          <Skeleton className="mb-2 h-4 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-16" />
      </div>
    </div>
  );
}


export function SettingsPayoutsSkeleton() {
  return (
    <div className="grid gap-8">
      <Skeleton className="mb-8 h-7 w-20" />
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="mt-2 h-4 w-96" />
              </div>
              <div className="justify-start p-0">
                <Skeleton className="h-10 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-28" />
          </CardHeader>
          <CardContent>
            <div className="p-4">
              <div className="grid justify-items-center gap-4 p-6 text-center">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-10 w-36" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SettingsTaxSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="mb-1 h-7 w-36" />
        <Skeleton className="h-5 w-96" />
      </hgroup>
      <div className="grid gap-4">
        <Skeleton className="h-16 w-full rounded-md border border-red-200 bg-red-50" />

        <div>
          <Skeleton className="mb-2 h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-56" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-48" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex">
              <Skeleton className="h-10 w-full rounded-r-none" />
              <Skeleton className="h-10 w-10 rounded-l-none" />
            </div>
          </div>
          <div>
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div>
          <Skeleton className="mb-2 h-4 w-8" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
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

      <div className="flex flex-wrap gap-8">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-4 w-96" />
      </div>
    </div>
  );
}



export function SettingsDetailsSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="mb-1 h-7 w-16" />
        <Skeleton className="h-5 w-96" />
      </hgroup>
      <div className="grid gap-4">
        <div>
          <Skeleton className="mb-2 h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-8" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>
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
        <Skeleton className="h-3 w-96" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}
