"use client";
import React, { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

const Jumper = ({
  sections,
  activeIndex,
  setActiveIndex,
  className,
}: {
  sections: string[];
  activeIndex?: number;
  setActiveIndex?: (index: number) => void;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div role="navigation" className={cn("grid gap-1", className)} ref={ref}>
      {sections.map((section, index) => (
        <a
          key={index}
          href={`#jump_${index + 1}`}
          className={`flex items-center no-underline ${index !== activeIndex ? "text-gray-500" : ""}`}
          onClick={() => setActiveIndex?.(index)}
        >
          <Badge
            variant={index === activeIndex ? "default" : "outline"}
            className="mr-1 shrink-0"
          >
            {index + 1}
          </Badge>
          <span className="truncate">{section}</span>
        </a>
      ))}
    </div>
  );
};

export default Jumper;
