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
import { useIsMobile } from "@/utils/use-mobile";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
    numeric?: boolean;
    filterOptions?: string[];
    hidden?: boolean;
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
  tabsColumn?: string | undefined;
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
  tabsColumn: tabsColumnName,
  contextMenuContent,
  selectionActions,
}: TableProps<T>) {
  const isMobile = useIsMobile();

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
        .filter((group) => group.headers.some((header) => header.column.columnDef.header))
        .map((group) => ({
          ...group,
          headers: group.headers.filter((header) => !header.column.columnDef.meta?.hidden),
        })),
      rows: table.getRowModel().rows,
      footers: table
        .getFooterGroups()
        .filter((group) => group.headers.some((header) => header.column.columnDef.footer))
        .map((group) => ({
          ...group,
          headers: group.headers.filter((header) => !header.column.columnDef.meta?.hidden),
        })),
    }),
    [table.getState()],
  );
  const sortable = !!table.options.getSortedRowModel;
  const filterable = !!table.options.getFilteredRowModel;
  const selectable = !!table.options.enableRowSelection;
  const filterableColumns = table.getAllColumns().filter((column) => column.columnDef.meta?.filterOptions);
  const tabFilterColumn = tabsColumnName
    ? table.getAllColumns().find((column) => column.id === tabsColumnName && column.columnDef.meta?.filterOptions)
    : null;
  const dropdownFilterColumns = filterableColumns.filter((column) =>
    tabsColumnName && isMobile ? column.id !== tabsColumnName : true,
  );

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

  const rowClasses = `px-1 py-2 md:px-0 ${isMobile ? "min-h-16 flex" : ""}`;
  const cellClasses = (column: Column<T> | null, type?: "header" | "footer") => {
    const numeric = column?.columnDef.meta?.numeric;
    return cn(
      column?.columnDef.meta?.cellClassName,
      numeric && "md:text-right print:text-right",
      numeric && type !== "header" && "tabular-nums",
      !numeric && "print:text-wrap",
      isMobile && "align-top",
    );
  };
  const searchColumn = searchColumnName ? table.getColumn(searchColumnName) : null;
  const getColumnName = (column: Column<T>) =>
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedRowCount = selectedRows.length;
  const tabFilterValue = filterValueSchema.optional().parse(tabFilterColumn?.getFilterValue());

  return (
    <div className="grid gap-3 md:gap-4">
      {filterable || actions ? (
        <div className="mx-4 grid gap-2 md:flex md:justify-between">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row">
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
                    className="w-full pl-8 text-sm font-light md:text-base"
                    placeholder={searchColumn ? `Search by ${getColumnName(searchColumn)}...` : "Search..."}
                  />
                </div>
              ) : null}
              {dropdownFilterColumns.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="small" className="w-9 md:w-auto">
                      <div className="flex items-center gap-1">
                        <ListFilterIcon className="size-4" strokeWidth={2.25} />
                        <span className="hidden md:block">Filter</span>
                        {!isMobile && activeFilterCount > 0 && (
                          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {dropdownFilterColumns.map((column) => {
                      const filterValue = filterValueSchema.optional().parse(column.getFilterValue());

                      return (
                        <DropdownMenuSub key={column.id}>
                          <DropdownMenuSubTrigger className="max-md:h-11">
                            <div className="box-border flex items-center gap-1">
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
                              className="max-md:h-11"
                            >
                              All
                            </DropdownMenuCheckboxItem>
                            {column.columnDef.meta?.filterOptions?.map((option) => (
                              <DropdownMenuCheckboxItem
                                className="max-md:h-11"
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

              {!isMobile && selectable ? (
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

            {/* Mobile tab filter chips */}
            {isMobile && tabFilterColumn ? (
              <div className="no-scrollbar flex gap-1 overflow-x-auto">
                <button
                  onClick={() => tabFilterColumn.setFilterValue(undefined)}
                  className={`bg-secondary h-9 rounded-full border px-4 text-sm leading-5 font-medium ${
                    !tabFilterValue?.length ? "border-blue-600 !bg-blue-600/5" : "border-border"
                  }`}
                >
                  All
                </button>
                {tabFilterColumn.columnDef.meta?.filterOptions?.map((option: string) => (
                  <button
                    key={option}
                    onClick={() => {
                      const currentValue = tabFilterValue;
                      tabFilterColumn.setFilterValue(
                        currentValue?.includes(option)
                          ? currentValue.length > 1
                            ? currentValue.filter((o) => o !== option)
                            : undefined
                          : [...(currentValue ?? []), option],
                      );
                    }}
                    className={`bg-secondary h-9 rounded-full border px-4 text-sm leading-5 font-medium whitespace-nowrap ${
                      tabFilterValue?.includes(option) ? "border-blue-600 !bg-blue-600/5" : "border-border"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex justify-between md:justify-end md:gap-2">{actions}</div> : null}
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
                        className="relative z-1 not-print:max-md:flex not-print:max-md:size-6 not-print:max-md:items-center not-print:max-md:justify-center"
                      />
                    </TableCell>
                  ) : null}
                  {row
                    .getVisibleCells()
                    .filter((cell) => !cell.column.columnDef.meta?.hidden)
                    .map((cell) => (
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
