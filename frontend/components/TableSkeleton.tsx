import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function TableSkeleton({ columns }: { columns: number }) {
  return (
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
