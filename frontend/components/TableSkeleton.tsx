import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  columns?: number;
  hasSelection?: boolean;
  rows?: number;
}

export default function TableSkeleton({ columns = 6, hasSelection = false, rows = 5 }: TableSkeletonProps) {
  return (
    <>
      <Table className="hidden md:table">
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {hasSelection ? (
                <TableCell className="w-12 min-w-12 py-2">
                  <Skeleton className="mx-auto h-4 w-4 rounded" />
                </TableCell>
              ) : null}
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex} className="py-2">
                  <Skeleton className="h-4 w-20 rounded" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table className="grid gap-4 md:hidden">
        <TableBody>
          {Array.from({ length: 3 }).map((_, rowIndex) => (
            <TableRow key={rowIndex} className="mb-2 flex flex-col gap-3 rounded-lg p-4">
              <Skeleton className="h-4 w-48 rounded" /> {/* Subtitle */}
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 rounded" /> {/* Left info */}
                <Skeleton className="h-6 w-16 rounded" /> {/* Button */}
              </div>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
