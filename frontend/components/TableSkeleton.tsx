import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  columns?: number;
  hasSelection?: boolean;
  rows?: number;
  renderRowsOnly?: boolean;
}

export default function TableSkeleton({
  columns = 6,
  hasSelection = false,
  rows = 5,
  renderRowsOnly = false,
}: TableSkeletonProps) {
  const skeletonRows = Array.from({ length: rows }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {hasSelection ? (
        <TableCell className="hidden w-12 min-w-12 py-2 md:table-cell">
          <Skeleton className="mx-auto h-4 w-4 rounded" />
        </TableCell>
      ) : null}
      <TableCell className="mb-2 flex flex-col gap-3 border-none p-4 md:hidden">
        <Skeleton className="h-4 w-48 rounded" /> {/* Subtitle */}
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20 rounded" /> {/* Left info */}
          <Skeleton className="h-4 w-16 rounded" /> {/* Button */}
        </div>
      </TableCell>
      {Array.from({ length: columns }).map((_, colIndex) => (
        <TableCell key={colIndex} className="hidden py-2 md:table-cell">
          <Skeleton className="h-4 w-20 rounded" />
        </TableCell>
      ))}
    </TableRow>
  ));

  if (renderRowsOnly) {
    return skeletonRows;
  }

  return (
    <Table>
      <TableBody>{skeletonRows}</TableBody>
    </Table>
  );
}
