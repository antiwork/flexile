import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function InvoicesTableSkeleton() {
  return (
    <div className="bg-white">
      <Table className="caption-top">
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="w-4 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded-sm" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-4 w-20 rounded" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-4 w-16 rounded" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-5 w-28 rounded" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-8 w-20 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
