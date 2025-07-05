import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function DividendRoundSkeleton() {
  return (
    <div className="bg-white">
      <Table className="caption-top not-print:max-md:grid">
        <TableBody className="not-print:max-md:contents">
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow
              key={i}
              className="py-2 not-print:max-md:grid not-print:max-md:grid-cols-1 not-print:max-md:gap-2"
            >
              <TableCell className="px-4 py-2">
                <Skeleton className="h-4 w-24 rounded" />
              </TableCell>
              <TableCell className="px-4 py-2">
                <Skeleton className="h-4 w-16 rounded" />
              </TableCell>
              <TableCell className="px-4 py-2">
                <Skeleton className="h-4 w-10 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
