import React from "react";
import { cn } from "@/utils";

const Figures = ({
  selected,
  items,
  onSelect,
}: {
  selected?: number;
  items: { caption: string; value: string | number }[];
  onSelect?: (index: number) => void;
}) => {
  const isTabs = selected != null;

  return (
    <div className="grid auto-cols-fr gap-4 gap-x-6 gap-y-4 lg:grid-flow-col" role={isTabs ? "tablist" : undefined}>
      {items.map((item, i) => (
        <figure
          key={item.caption}
          className={cn(
            "rounded-2xl border p-6 text-xl font-bold",
            i === selected ? "bg-opacity-20 border-blue-600 bg-blue-600" : "border-gray-500",
            isTabs ? "hover:bg-opacity-20 cursor-pointer hover:bg-blue-600" : "",
          )}
          role={isTabs ? "tab" : undefined}
          aria-selected={isTabs ? i === selected : undefined}
          onClick={() => onSelect?.(i)}
        >
          <div className="text-1xl">{item.value}</div>
          <figcaption className="text-base font-normal">{item.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
};

export default Figures;
