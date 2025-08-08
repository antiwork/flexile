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
import { ChevronDown, ChevronUp, ListFilterIcon, SearchIcon, X } from "lucide-react";
import React, { useMemo } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
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
    className?: string;
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
    defaultColumn: {
      filterFn: (row, columnId, filterValue, addMeta) => {
        const fn = row._getAllCellsByColumnId()[columnId]?.column.getAutoFilterFn();
        if (!fn) return true;
        const filter = (value: unknown) => fn(row, columnId, value, addMeta);
        return Array.isArray(filterValue) ? filterValue.some(filter) : filter(filterValue);
      },
    },
  });

interface TableProps<T> {
  table: Table<T>;
  onRowClicked?: ((row: T) => void) | undefined;
  actions?: React.ReactNode;
  searchColumn?: string | undefined;
  contextMenuContent?: (context: {
    row: T;
    isSelected: boolean;
    selectedCount: number;
    selectedRows: T[];
    onClearSelection: () => void;
  }) => React.ReactNode;
  selectionActions?: (selectedRows: T[]) => React.ReactNode;
}

export default function DataTable<T extends RowData>({
  table,
  onRowClicked,
  actions,
  searchColumn: searchColumnName,
  contextMenuContent,
  selectionActions,
}: TableProps<T>) {
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        table.toggleAllRowsSelected(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [table]);

  const data = useMemo(
    () => ({
      headers: table
        .getHeaderGroups()
        .filter((group) => group.headers.some((header) => header.column.columnDef.header)),
      rows: table.getRowModel().rows,
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
  const cellClasses = (column: Column<T> | null, type?: "header" | "footer") => {
    const numeric = column?.columnDef.meta?.numeric;
    return cn(
      numeric && "md:text-right print:text-right",
      numeric && type !== "header" && "tabular-nums",
      !numeric && "print:text-wrap",
    );
  };
  const searchColumn = searchColumnName ? table.getColumn(searchColumnName) : null;
  const getColumnName = (column: Column<T>) =>
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedRowCount = selectedRows.length;

  return (
    <div className="grid gap-4">
      {filterable || actions ? (
        <div className="mx-4 grid gap-2 md:flex md:justify-between">
          <div className="flex gap-2">
            {table.options.enableGlobalFilter !== false ? (
              <div className="relative w-full md:w-60">
                <SearchIcon className="absolute top-2.5 left-2.5 size-4" />
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
                  className="w-full pl-8"
                  placeholder={searchColumn ? `Search by ${getColumnName(searchColumn)}...` : "Search..."}
                />
              </div>
            ) : null}
            {filterableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="small">
                    <div className="flex items-center gap-1">
                      <ListFilterIcon className="size-4" />
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
                      <DropdownMenuItem variant="destructive" onSelect={() => table.resetColumnFilters(true)}>
                        Clear all filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {selectable ? (
              <div className={cn("flex gap-2", selectedRowCount === 0 && "pointer-events-none opacity-0")}>
                <div className="bg-accent border-muted flex h-9 items-center justify-center rounded-md border border-dashed px-2 font-medium">
                  <span className="text-sm whitespace-nowrap">
                    <span className="inline-block w-4 text-center tabular-nums">{selectedRowCount}</span> selected
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mr-1 size-6 p-0 hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      table.toggleAllRowsSelected(false);
                    }}
                  >
                    <X className="size-4 shrink-0" aria-hidden="true" />
                  </Button>
                </div>
                {selectionActions?.(selectedRows)}
              </div>
            ) : null}
          </div>
          <div className="flex justify-between md:justify-end md:gap-2">{actions}</div>
        </div>
      ) : null}

      <ShadcnTable className="caption-top not-print:max-md:grid">
        <TableHeader className="not-print:max-md:hidden">
          {data.headers.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {selectable ? (
                <TableHead className={cellClasses(null, "header")}>
                  <Checkbox
                    checked={table.getIsSomeRowsSelected() ? "indeterminate" : table.getIsAllRowsSelected()}
                    aria-label="Select all"
                    onCheckedChange={() => table.toggleAllRowsSelected()}
                  />
                </TableHead>
              ) : null}
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={`${cellClasses(header.column, "header")} ${sortable && header.column.getCanSort() ? "cursor-pointer" : ""} ${header.column.columnDef.meta?.className || ""}`}
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
                  {header.column.getIsSorted() === "asc" && <ChevronUp className="inline size-5" />}
                  {header.column.getIsSorted() === "desc" && <ChevronDown className="inline size-5" />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="not-print:max-md:contents">
          {data.rows.length > 0 ? (
            data.rows.map((row) => {
              const isSelected = row.getIsSelected();
              const rowContent = (
                <TableRow
                  key={row.id}
                  className={`${rowClasses} ${onRowClicked ? "cursor-pointer" : ""}`}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => onRowClicked?.(row.original)}
                >
                  {selectable ? (
                    <TableCell className={cellClasses(null)} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
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
                      className={`${cellClasses(cell.column)} ${cell.column.id === "actions" ? "relative z-1 md:text-right print:hidden" : ""} ${cell.column.columnDef.meta?.className || ""}`}
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

              const menuContent = contextMenuContent?.({
                row: row.original,
                isSelected,
                selectedCount: selectedRowCount,
                selectedRows,
                onClearSelection: () => table.toggleAllRowsSelected(false),
              });

              return menuContent ? (
                <ContextMenu key={row.id} modal={false}>
                  <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
                  {menuContent}
                </ContextMenu>
              ) : (
                rowContent
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
    </div>
  );
}
