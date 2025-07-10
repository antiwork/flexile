import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function SettingsFormSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-4 w-96" />
      </hgroup>
      <div className="grid gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function SettingsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsProfileSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-7 w-16 mb-4" />
      <div className="grid gap-4">
        <div>
          <Skeleton className="h-4 w-12 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-64 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-16" />
      </div>
    </div>
  );
}

export function SettingsCompanyBrandingSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-5 w-96" />
      </hgroup>
      
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-12 w-12 rounded-md" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        
        <Skeleton className="h-10 w-28" />
      </div>
      
      <Skeleton className="h-32 w-full" />
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPayoutsSkeleton() {
  return (
    <div className="grid gap-8">
      <Skeleton className="h-7 w-20 mb-8" />
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-20" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-96 mt-2" />
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
        <Skeleton className="h-7 w-36 mb-1" />
        <Skeleton className="h-5 w-96" />
      </hgroup>
      <div className="grid gap-4">
        <Skeleton className="h-16 w-full rounded-md border border-red-200 bg-red-50" />
        
        <div>
          <Skeleton className="h-4 w-64 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div>
          <Skeleton className="h-4 w-36 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div>
          <Skeleton className="h-4 w-28 mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        
        <div>
          <Skeleton className="h-4 w-56 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex justify-between mb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex">
              <Skeleton className="h-10 w-full rounded-r-none" />
              <Skeleton className="h-10 w-10 rounded-l-none" />
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        
        <div>
          <Skeleton className="h-4 w-64 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div>
          <Skeleton className="h-4 w-8 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-12 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
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

export function SettingsEquitySkeleton() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-8">
        <hgroup>
          <Skeleton className="h-7 w-16 mb-1" />
          <Skeleton className="h-5 w-96" />
        </hgroup>
        <div className="grid gap-4">
          <div>
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-44 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

export function SettingsBillingSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-7 w-16 mb-8" />
      
      <hgroup>
        <Skeleton className="h-5 w-28 mb-1" />
        <Skeleton className="h-4 w-full" />
      </hgroup>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
          <div className="mt-2">
            <Skeleton className="h-9 w-12" />
          </div>
        </CardHeader>
      </Card>

      <Skeleton className="h-32 w-full" />
      
      <Skeleton className="h-5 w-28 mt-4" />
      
      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-96 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Skeleton className="h-10 w-10 mx-auto mb-2 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

export function SettingsDetailsSkeleton() {
  return (
    <div className="grid gap-8">
      <hgroup>
        <Skeleton className="h-7 w-16 mb-1" />
        <Skeleton className="h-5 w-96" />
      </hgroup>
      <div className="grid gap-4">
        <div>
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-8 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-72 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-12 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-3 w-96" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}