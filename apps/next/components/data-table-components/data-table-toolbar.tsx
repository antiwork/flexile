"use client";

// import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { incomeType, categories } from "./data";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
// import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import { CalendarDatePicker } from "@/components/calendar-date-picker";
import { useState } from "react";
import { DataTableViewOptions } from "./data-table-view-options";
import { PayRateType } from "@/db/enums";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal } from "lucide-react"
import DataTableRangeFilter from "../../components/DataTabelRangeFillter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date()
  });

  const handleDateSelect = ({ from, to }: { from: Date; to: Date }) => {
    setDateRange({ from, to });
    // Filter table data based on selected date range
    table.getColumn("date")?.setFilterValue([from, to]);
  };

  return (
    <div className="flex flex-wrap items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <label>Role</label>
          <Input
            placeholder="Filter role..."
            value={(table.getColumn("role")?.getFilterValue() as string) ?? ""}
            onChange={(event) => {
              table.getColumn("role")?.setFilterValue(event.target.value);
            }}
            className="h-8 w-[150px] lg:w-[250px]"
          />

        </div>

        {/* {table.getColumn("payRateInSubunits") && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Rate
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <DataTableRangeFilter
                column={table.getColumn("payRateInSubunits")}
                title="Rate Range"
              />
            </PopoverContent>
          </Popover>
        )} */}
        {table.getColumn("rate") && (
          <DataTableRangeFilter
            column={table.getColumn("rate")}
            title="Rate"
          // options={incomeType}
          />
        )}

        {/* <CalendarDatePicker
          date={dateRange}
          onDateSelect={handleDateSelect}
          className="w-[250px] h-8"
          variant="outline"
        /> */}
      </div>

      <DataTableViewOptions table={table} />
    </div>
  );
}
