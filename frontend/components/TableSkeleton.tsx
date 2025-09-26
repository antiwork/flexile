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
  const desktopSkeletonRows = Array.from({ length: rows }).map((_, rowIndex) => (
    <TableRow key={`desktop-${rowIndex}`} className="hidden md:table-row">
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
  ));

  const mobileSkeletonRows = Array.from({ length: 3 }).map((_, rowIndex) => (
    <TableRow key={`mobile-${rowIndex}`} className="mb-2 flex flex-col gap-3 p-4 md:hidden">
      <Skeleton className="h-4 w-48 rounded" /> {/* Subtitle */}
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20 rounded" /> {/* Left info */}
        <Skeleton className="h-4 w-16 rounded" /> {/* Button */}
      </div>
    </TableRow>
  ));

  if (renderRowsOnly) {
    return (
      <>
        {desktopSkeletonRows}
        {mobileSkeletonRows}
      </>
    );
  }

  return (
    <Table>
      <TableBody>
        {desktopSkeletonRows}
        {mobileSkeletonRows}
      </TableBody>
    </Table>
  );
}
