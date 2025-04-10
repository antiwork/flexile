import { Input } from "@/components/ui/input";
import React from "react";

function DataTableRangeFilter({
  column,
  title,
}: {
  column: any;
  title: string;
}) {
  const [min, setMin] = React.useState<string>("");
  const [max, setMax] = React.useState<string>("");

  // React.useEffect(() => {
  //   console.log("Current filter:", column.getFilterValue());
  // }, [column.getFilterValue()]);

  // Auto apply filter when max is filled
  React.useEffect(() => {
    console.log("max value",max)
    if (max === undefined || max === "") {
      // Reset the filter to default (show all)
      column.setFilterValue(undefined);
      return;
    }
  
    const minNum = min ? Number(min) : -Infinity;
    const maxNum = Number(max);
    console.log("Auto-applying filter:", { minNum, maxNum });
    column.setFilterValue([minNum, maxNum]);
  }, [max]);

  return (
    <div className="flex flex-col space-y-2 p-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="flex space-x-2">
        <Input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-8 w-24 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"

        />
        <Input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="h-8 w-24 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"

        />
      </div>
    </div>
  );
}

export default DataTableRangeFilter;
