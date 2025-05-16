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
import { useVirtualizer } from "@tanstack/react-virtual";
import { FilterIcon, SearchIcon } from "lucide-react";
import React, { useMemo, useRef } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
    filterOptions?: string[];
  }
}

export const filterValueSchema = z.array(z.string()).nullable();

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
    autoResetPageIndex: false, // work around https://github.com/TanStack/table/issues/5026
    ...options,
    getCoreRowModel: getCoreRowModel(),
  });

interface TableProps<T> {
  table: Table<T>;
  caption?: string;
  onRowClicked?: ((row: T) => void) | undefined;
  actions?: React.ReactNode;
  searchColumn?: string | undefined;
  rowHeight?: number;
  virtualized?: boolean;
  overscan?: number;
}

const cellClasses = <T extends RowData>(column: Column<T> | null, type?: "header" | "footer") => {
  const numeric = column?.columnDef.meta?.numeric;
  return cn(
    numeric && "md:text-right print:text-right",
    numeric && type !== "header" && "tabular-nums",
    !numeric && "print:text-wrap",
  );
};

export default function DataTable<T extends RowData>(props: TableProps<T>) {
  const {
    table,
    caption,
    onRowClicked,
    actions,
    searchColumn: searchColumnName,
    rowHeight = 40,
    virtualized = false,
    overscan = 5,
  } = props;
  const data = useMemo(
    () => ({
      headers: table
        .getHeaderGroups()
        .filter((group) => group.headers.some((header) => header.column.columnDef.header)),
      footers: table
        .getFooterGroups()
        .filter((group) => group.headers.some((header) => header.column.columnDef.footer)),
    }),
    [table.getState()],
  );
  const sortable = !!table.options.getSortedRowModel;
  const filterable = !!table.options.getFilteredRowModel;
  const selectable = !!table.options.enableRowSelection;
  const filterableColumns = table.getAllColumns().filter((column) => column.columnDef.meta?.filterOptions);

  const activeFilterCount = useMemo(
    () =>
      table
        .getState()
        .columnFilters.reduce(
          (count, filter) => count + (Array.isArray(filter.value) ? filter.value.length : filter.value ? 1 : 0),
          0,
        ),
    [table.getState().columnFilters],
  );

  const rowClasses = "py-2 not-print:max-md:grid";
  const searchColumn = searchColumnName ? table.getColumn(searchColumnName) : null;
  const getColumnName = (column: Column<T>) =>
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";

  const ref = useRef<HTMLDivElement>(null);

  const rows = table.getRowModel().rows;
  const scrollElement = useMemo(() => {
    let node: HTMLElement | null = ref.current;
    while (node?.parentElement && getComputedStyle(node).overflowY === "visible") {
      node = node.parentElement;
    }
    return node;
  }, [ref.current]);
  const paddingStart = useMemo(() => {
    if (!scrollElement || !ref.current) return 0;
    return ref.current.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top;
  }, [scrollElement]);
  const virtualizer = virtualized
    ? useVirtualizer({
        count: rows.length * 10,
        getScrollElement: () => scrollElement,
        estimateSize: () => rowHeight,
        overscan,
      })
    : null;

  return (
    <div className="grid gap-4" ref={ref}>
      {filterable || actions ? (
        <div className="flex justify-between">
          <div className="flex gap-2">
            {table.options.enableGlobalFilter !== false ? (
              <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  value={
                    z
                      .string()
                      .nullish()
                      .parse(searchColumn ? searchColumn.getFilterValue() : table.getState().globalFilter) ?? ""
                  }
                  onChange={(e) =>
                    searchColumn ? searchColumn.setFilterValue(e.target.value) : table.setGlobalFilter(e.target.value)
                  }
                  className="w-60 pl-8"
                  placeholder={searchColumn ? `Search by ${getColumnName(searchColumn)}...` : "Search..."}
                />
              </div>
            ) : null}
            {filterableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="small">
                    <div className="flex items-center gap-1">
                      <FilterIcon className="text-muted-foreground size-4" />
                      Filter
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {filterableColumns.map((column) => {
                    const filterValue = filterValueSchema.optional().parse(column.getFilterValue());
                    return (
                      <DropdownMenuSub key={column.id}>
                        <DropdownMenuSubTrigger>
                          <div className="flex items-center gap-1">
                            <span>{getColumnName(column)}</span>
                            {Array.isArray(filterValue) && filterValue.length > 0 && (
                              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                {filterValue.length}
                              </Badge>
                            )}
                          </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuCheckboxItem
                            checked={!filterValue?.length}
                            onCheckedChange={() => column.setFilterValue(undefined)}
                          >
                            All
                          </DropdownMenuCheckboxItem>
                          {column.columnDef.meta?.filterOptions?.map((option) => (
                            <DropdownMenuCheckboxItem
                              key={option}
                              checked={filterValue?.includes(option) ?? false}
                              onCheckedChange={(checked) =>
                                column.setFilterValue(
                                  checked
                                    ? [...(filterValue ?? []), option]
                                    : filterValue && filterValue.length > 1
                                      ? filterValue.filter((o) => o !== option)
                                      : undefined,
                                )
                              }
                            >
                              {option}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                  {activeFilterCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => table.resetColumnFilters()}>
                        Clear all filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <div className="flex gap-2">{actions}</div>
        </div>
      ) : null}

      {virtualized && virtualizer ? (
        <div style={{ height: `${virtualizer.getTotalSize()}px` }} className="relative">
          <ShadcnTable
            className="absolute w-full caption-top not-print:max-md:grid"
            style={{ top: `${virtualizer.getVirtualItems()[0]?.start ?? 0}px` }}
          >
            {caption ? (
              <TableCaption className="mb-2 text-left text-lg font-bold text-black">{caption}</TableCaption>
            ) : null}
            <TableHeader className="not-print:max-md:hidden">
              {data.headers.map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {selectable ? (
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
                      className={`${cellClasses(header.column, "header")} ${sortable && header.column.getCanSort() ? "cursor-pointer" : ""}`}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                      onClick={() => sortable && header.column.getCanSort() && header.column.toggleSorting()}
                    >
                      {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUpIcon className="inline size-5" />}
                      {header.column.getIsSorted() === "desc" && <ChevronDownIcon className="inline size-5" />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="not-print:max-md:contents">
              {table.getRowModel().rows.length > 0 ? (
                virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index % rows.length];
                  if (!row) return null;

                  return (
                    <TableRow
                      key={virtualRow.index}
                      style={{
                        top: `${virtualRow.start - paddingStart}px`,
                        height: `${virtualRow.size}px`,
                      }}
                      className="w-full"
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      onClick={() => onRowClicked?.(row.original)}
                    >
                      {table.options.enableRowSelection ? (
                        <TableCell className={cellClasses(null)} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={row.getIsSelected()}
                            aria-label="Select row"
                            disabled={!row.getCanSelect()}
                            onCheckedChange={row.getToggleSelectedHandler()}
                            className="relative z-1"
                          />
                        </TableCell>
                      ) : null}
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={`${cellClasses(cell.column)} ${cell.column.id === "actions" ? "relative z-1 md:text-right print:hidden" : ""}`}
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
                  );
                })
              ) : (
                <TableRow className="h-24">
                  <TableCell colSpan={table.getAllColumns().length} className="text-center align-middle">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {data.footers.length > 0 && (
              <TableFooter>
                {data.footers.map((footerGroup) => (
                  <TableRow key={footerGroup.id} className={rowClasses}>
                    {selectable ? <TableCell className={cellClasses(null, "footer")} /> : null}
                    {footerGroup.headers.map((header) => (
                      <TableCell
                        key={header.id}
                        className={cellClasses(header.column, "footer")}
                        colSpan={header.colSpan}
                      >
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
        </div>
      ) : (
        <ShadcnTable className="caption-top not-print:max-md:grid">
          {caption ? (
            <TableCaption className="mb-2 text-left text-lg font-bold text-black">{caption}</TableCaption>
          ) : null}
          <TableHeader className="not-print:max-md:hidden">
            {data.headers.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {selectable ? (
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
                    className={`${cellClasses(header.column, "header")} ${sortable && header.column.getCanSort() ? "cursor-pointer" : ""}`}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                    onClick={() => sortable && header.column.getCanSort() && header.column.toggleSorting()}
                  >
                    {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && <ChevronUpIcon className="inline size-5" />}
                    {header.column.getIsSorted() === "desc" && <ChevronDownIcon className="inline size-5" />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="not-print:max-md:contents">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={rowClasses}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={() => onRowClicked?.(row.original)}
                >
                  {selectable ? (
                    <TableCell className={cellClasses(null)} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={row.getIsSelected()}
                        aria-label="Select row"
                        disabled={!row.getCanSelect()}
                        onCheckedChange={row.getToggleSelectedHandler()}
                        className="relative z-1"
                      />
                    </TableCell>
                  ) : null}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`${cellClasses(cell.column)} ${cell.column.id === "actions" ? "relative z-1 md:text-right print:hidden" : ""}`}
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
              ))
            ) : (
              <TableRow className="h-24">
                <TableCell colSpan={table.getAllColumns().length} className="text-center align-middle">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {data.footers.length > 0 && (
            <TableFooter>
              {data.footers.map((footerGroup) => (
                <TableRow key={footerGroup.id} className={rowClasses}>
                  {selectable ? <TableCell className={cellClasses(null, "footer")} /> : null}
                  {footerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      className={cellClasses(header.column, "footer")}
                      colSpan={header.colSpan}
                    >
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
      )}
    </div>
  );
}
