import { Skeleton } from "@/components/ui/skeleton";

export const DetailsSkeleton = () => {
    return (
        <div className="space-y-8 md:space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-full max-w-md mb-8" />
            </div>

            <div className="space-y-2 mt-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-full" />
            </div>

            <div className="space-y-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-10 w-full" />
            </div>

            <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
            </div>

            <div className="space-y-2">
                <Skeleton className="h-4 w-[260px]" />
                <Skeleton className="h-10 w-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>

            <Skeleton className="h-4 w-[280px]" />
            <Skeleton className="h-10 w-32 rounded-md mt-6" />
        </div>

    );
}