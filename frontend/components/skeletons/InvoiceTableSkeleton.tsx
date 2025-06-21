import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

interface InvoiceTableSkeletonProps {
  rows?: number;
  isAdministrator?: boolean;
}

export function InvoiceTableSkeleton({ rows = 5, isAdministrator = false }: InvoiceTableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index} className="py-2">
          <TableCell>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
            </div>
          </TableCell>
          <TableCell>
            {isAdministrator ? (
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <Skeleton className="h-4 w-24" />
            )}
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}
