import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/utils/use-mobile";

export default function TableSkeleton({ columns }: { columns: number }) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <div className="mx-4 mt-8 flex flex-col gap-4">
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Table className="not-print:max-md:grid">
      <TableBody className="not-print:max-md:contents">
        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <TableRow
            key={rowIndex}
            className="py-2 not-print:max-md:grid not-print:max-md:grid-cols-1 not-print:max-md:gap-2"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex} className="px-4 py-2">
                <Skeleton className={colIndex === columns - 1 ? "h-6 w-24 rounded" : "h-4 w-24 rounded"} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
