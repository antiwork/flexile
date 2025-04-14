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
  hoverable?: boolean;
  onRowClicked?: ((row: T) => void) | undefined;
}

export default function Table<T extends RowData>({ table, caption, hoverable, onRowClicked }: TableProps<T>) {
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

  const cellClasses = (row: unknown, column: Column<T> | null, type?: "header" | "footer") => {
    const index = column?.getIndex() ?? -1;
    const isFirst = row === data.firstRow && type !== "footer";
    const isLast = row === data.lastRow && (data.footers.length === 0 || type === "footer");
    const numeric = column?.columnDef.meta?.numeric;
    return cn(
      "md:p-2 print:p-2 text-nowrap",
      type === "header" && "font-normal text-gray-500 text-left",
      numeric && "md:text-right print:text-right",
      numeric && type !== "header" && "tabular-nums",
      !numeric && "print:text-wrap",
      !isLast && "md:border-b print:border-b",
      isFirst && index === (data.selectable ? -1 : 0) && "rounded-tl-xl",
      isFirst && index === table.getAllColumns().length - 1 && "rounded-tr-xl",
      isLast && index === (data.selectable ? -1 : 0) && "rounded-bl-xl",
      isLast && index === table.getAllColumns().length - 1 && "rounded-br-xl",
    );
  };

  return (
    <table className="w-full border-separate border-spacing-0 gap-4 rounded-xl not-print:max-md:grid md:border print:border">
      {caption ? <caption className="mb-2 text-left text-lg font-bold">{caption}</caption> : null}
      <thead className="not-print:max-md:hidden">
        {data.headers.map((headerGroup) => (
          <tr key={headerGroup.id}>
            {data.selectable ? (
              <th className={cellClasses(headerGroup, null, "header")}>
                <div className="grid items-center">
                  <Checkbox
                    checked={table.getIsAllRowsSelected()}
                    aria-label="Select all"
                    onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
                  />
                </div>
              </th>
            ) : null}
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                className={`${cellClasses(headerGroup, header.column, "header")} ${data.sortable && header.column.getCanSort() ? "cursor-pointer" : ""}`}
                aria-sort={
                  header.column.getIsSorted() === "asc"
                    ? "ascending"
                    : header.column.getIsSorted() === "desc"
                      ? "descending"
                      : undefined
                }
                onClick={() => data.sortable && header.column.getCanSort() && header.column.toggleSorting()}
              >
                <div className="inline-flex items-center gap-1">
                  {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" && <ChevronUpIcon className="size-5" />}
                  {header.column.getIsSorted() === "desc" && <ChevronDownIcon className="size-5" />}
                </div>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className="not-print:max-md:contents">
        {data.rows.map((row) => (
          <tr
            key={row.id}
            className={`translate-x-0 gap-3 border p-4 not-print:max-md:grid not-print:max-md:rounded-xl ${onRowClicked || hoverable ? "cursor-pointer hover:bg-gray-50" : ""} ${data.selectable ? "bg-linear-to-r from-blue-100 from-50% via-transparent via-50% bg-[length:200%] transition-all" : ""} ${!row.getIsSelected() ? "bg-[100%]" : ""}`}
            onClick={() => onRowClicked?.(row.original)}
          >
            {data.selectable ? (
              <td className={cellClasses(row, null)} onClick={(e) => e.stopPropagation()}>
                <div className="grid items-center">
                  <Checkbox
                    checked={row.getIsSelected()}
                    aria-label="Select row"
                    disabled={!row.getCanSelect()}
                    onCheckedChange={row.getToggleSelectedHandler()}
                  />
                </div>
              </td>
            ) : null}
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={`${cellClasses(row, cell.column)} ${cell.column.columnDef.meta?.numeric ? "tabular-nums md:text-right print:text-right" : ""} ${cell.column.id === "actions" ? "md:text-right print:hidden" : ""}`}
                onClick={(e) => cell.column.id === "actions" && e.stopPropagation()}
              >
                {typeof cell.column.columnDef.header === "string" && (
                  <div className="text-gray-500 md:hidden print:hidden" aria-hidden>
                    {cell.column.columnDef.header}
                  </div>
                )}
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {data.footers.length > 0 && (
        <tfoot>
          {data.footers.map((footerGroup) => (
            <tr key={footerGroup.id}>
              {data.selectable ? <td className={cellClasses(footerGroup, null, "footer")} /> : null}
              {footerGroup.headers.map((header) => (
                <td
                  key={header.id}
                  className={cellClasses(footerGroup, header.column, "footer")}
                  colSpan={header.colSpan}
                >
                  {!header.isPlaceholder && flexRender(header.column.columnDef.footer, header.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      )}
    </table>
  );
}
