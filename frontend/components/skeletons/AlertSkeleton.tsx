import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AlertSkeleton() {
  return (
    <Alert>
      <Skeleton className="h-5 w-5" />
      <AlertDescription>
        <Skeleton className="h-4 w-full max-w-md" />
      </AlertDescription>
    </Alert>
  );
}

export function AlertWithTitleSkeleton() {
  return (
    <Alert>
      <Skeleton className="h-5 w-5" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </Alert>
  );
}
