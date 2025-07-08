import { Skeleton } from "@/components/ui/skeleton";

const WorkspaceSettingSkeleton = () => (
  <div className="grid gap-8">
    <Skeleton className="h-8 w-80" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="h-10 w-30" />
    </div>
  </div>
);

export default WorkspaceSettingSkeleton;
