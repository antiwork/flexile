import React from "react";
import { cn } from "@/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/Tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

const Figures = ({
  selected,
  items,
  onSelect,
}: {
  selected?: number;
  items: { caption: string; value: string | number; tooltip?: React.ReactNode }[];
  onSelect?: (index: number) => void;
}) => {
  const isTabs = selected != null;
  return (
    <TooltipProvider>
      <div className="grid auto-cols-fr gap-4 gap-x-4 gap-y-4 lg:grid-flow-col" role={isTabs ? "tablist" : undefined}>
        {items.map((item, i) => (
          <figure
            key={item.caption}
            className={cn(
              "border-input bg-card text-card-foreground relative flex h-full flex-col rounded-lg border p-4 text-xl shadow-xs",
              i === selected ? "bg-opacity-20 border-blue-600 bg-blue-600" : "",
              isTabs ? "hover:bg-opacity-20 cursor-pointer hover:bg-blue-600" : "",
            )}
            role={isTabs ? "tab" : undefined}
            aria-selected={isTabs ? i === selected : undefined}
            onClick={() => onSelect?.(i)}
          >
            <div className="mb-2 text-3xl font-normal">{item.value}</div>
            <figcaption className="mt-auto flex items-center gap-1 text-base font-normal">
              {item.caption}
              {item.tooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InformationCircleIcon className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                  </TooltipTrigger>
                  <TooltipContent>{item.tooltip}</TooltipContent>
                </Tooltip>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </TooltipProvider>
  );
};

export default Figures;
