import type React from "react";
import { cn } from "@/utils";

export default function ColorPicker(props: React.ComponentProps<"input">) {
  return (
    <div className="relative size-12 overflow-hidden rounded-full border">
      <input {...props} type="color" className={cn("absolute -inset-1/2 size-auto cursor-pointer", props.className)} />
    </div>
  );
}
