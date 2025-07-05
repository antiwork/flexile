import { Skeleton } from "@/components/ui/skeleton";

const WorkspaceSettingSkeleton = () => {
  return (
    <div className="space-y-6 max-w-screen mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-4 w-128" />
      </div>

      <div className="flex items-center space-x-12">
        <div className="space-y-2">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-14 w-64 rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-84" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-10 w-36 rounded-md" />
    </div>
  );
};

export default WorkspaceSettingSkeleton;

