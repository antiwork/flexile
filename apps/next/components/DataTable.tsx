import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import {
  type AccessorKeyColumnDef,
  type Column,
  createColumnHelper as originalCreateColumnHelper,
  type DeepKeys,
  type DeepValue,
  flexRender,
  getCoreRowModel,
  type RowData,
  type Table,
  type TableOptions,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table as ShadcnTable,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    numeric?: boolean;
  }
}

export const createColumnHelper = <T extends RowData>() => {
  const helper = originalCreateColumnHelper<T>();
  return {
    ...helper,
    simple: <K extends DeepKeys<T>, V extends DeepValue<T, K>>(
      accessor: K,
      header: string,
      cell?: (value: V) => React.ReactNode,
      type?: "numeric",
    ): AccessorKeyColumnDef<T, V> =>
      helper.accessor(accessor, {
        header,
        ...(cell ? { cell: (info) => cell(info.getValue()) } : {}),
        meta: { numeric: type === "numeric" },
      }),
  };
};

export const useTable = <T extends RowData>(
  options: Partial<TableOptions<T>> & Pick<TableOptions<T>, "data" | "columns">,
) =>
  useReactTable({
    enableRowSelection: false,
    ...options,
    getCoreRowModel: getCoreRowModel(),
  });

interface TableProps<T> {
  table: Table<T>;
  caption?: string;
  onRowClicked?: ((row: T) => void) | undefined;
}

export default function DataTable<T extends RowData>({ table, caption, onRowClicked }: TableProps<T>) {
  const data = useMemo(() => {
    const headers = table
      .getHeaderGroups()
      .filter((group) => group.headers.some((header) => header.column.columnDef.header));
    const rows = table.getRowModel().rows;
    const footers = table
      .getFooterGroups()
      .filter((group) => group.headers.some((header) => header.column.columnDef.footer));
    const firstRow = headers[0] ?? rows[0] ?? footers[0];
    const lastRow = (footers.length ? footers : rows.length ? rows : headers).at(-1);
    const sortable = !!table.options.getSortedRowModel;
    const selectable = !!table.options.enableRowSelection;
    return { headers, rows, footers, firstRow, lastRow, sortable, selectable };
  }, [table.getState()]);

  const rowClasses = "py-2 not-print:max-md:grid";
  const cellClasses = (column: Column<T> | null, type?: "header" | "footer") => {
    const numeric = column?.columnDef.meta?.numeric;
    return cn(
      numeric && "md:text-right print:text-right",
      numeric && type !== "header" && "tabular-nums",
      !numeric && "print:text-wrap",
    );
  };

  return (
    <ShadcnTable className="caption-top not-print:max-md:grid">
      {caption ? <TableCaption className="mb-2 text-left text-lg font-bold text-black">{caption}</TableCaption> : null}
      <TableHeader className="not-print:max-md:hidden">
        {data.headers.map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {data.selectable ? (
              <TableHead className={cellClasses(null, "header")}>
                <Checkbox
                  checked={table.getIsAllRowsSelected()}
                  aria-label="Select all"
                  onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
                />
              </TableHead>
            ) : null}
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                colSpan={header.colSpan}
                className={`${cellClasses(header.column, "header")} ${data.sortable && header.column.getCanSort() ? "cursor-pointer" : ""}`}
                aria-sort={
                  header.column.getIsSorted() === "asc"
                    ? "ascending"
                    : header.column.getIsSorted() === "desc"
                      ? "descending"
                      : undefined
                }
                onClick={() => data.sortable && header.column.getCanSort() && header.column.toggleSorting()}
              >
                {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === "asc" && <ChevronUpIcon className="size-5" />}
                {header.column.getIsSorted() === "desc" && <ChevronDownIcon className="size-5" />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody className="not-print:max-md:contents">
        {data.rows.map((row) => (
          <TableRow
            key={row.id}
            className={`translate-x-0 ${rowClasses}`}
            data-state={row.getIsSelected() ? "selected" : undefined}
            onClick={() => onRowClicked?.(row.original)}
          >
            {data.selectable ? (
              <TableCell className={cellClasses(null)} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={row.getIsSelected()}
                  aria-label="Select row"
                  disabled={!row.getCanSelect()}
                  onCheckedChange={row.getToggleSelectedHandler()}
                />
              </TableCell>
            ) : null}
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={`${cellClasses(cell.column)} ${cell.column.id === "actions" ? "md:text-right print:hidden" : ""}`}
                onClick={(e) => cell.column.id === "actions" && e.stopPropagation()}
              >
                {typeof cell.column.columnDef.header === "string" && (
                  <div className="text-gray-500 md:hidden print:hidden" aria-hidden>
                    {cell.column.columnDef.header}
                  </div>
                )}
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {data.footers.length > 0 && (
        <TableFooter>
          {data.footers.map((footerGroup) => (
            <TableRow key={footerGroup.id} className={rowClasses}>
              {data.selectable ? <TableCell className={cellClasses(null, "footer")} /> : null}
              {footerGroup.headers.map((header) => (
                <TableCell key={header.id} className={cellClasses(header.column, "footer")} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : (
                    <>
                      {typeof header.column.columnDef.header === "string" && (
                        <div className="text-gray-500 md:hidden print:hidden" aria-hidden>
                          {header.column.columnDef.header}
                        </div>
                      )}
                      {flexRender(header.column.columnDef.footer, header.getContext())}
                    </>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableFooter>
      )}
    </ShadcnTable>
  );
}
