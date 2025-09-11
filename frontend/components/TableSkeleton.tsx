import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      <Table className="hidden md:table">
        <TableBody>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex} className="px-4 py-2">
                  <Skeleton className={colIndex === columns - 1 ? "h-6 w-24 rounded" : "h-4 w-24 rounded"} />
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
              <Skeleton className="h-4 w-32 rounded" /> {/* Title */}
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
