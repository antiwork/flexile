import * as React from "react";
import { cn } from "@/utils";

function HorizontalDivider({ className, omit = false, ...props }: React.ComponentProps<"div"> & { omit?: boolean }) {
  return omit ? null : <div data-slot="horizontal-divider" className={cn("my-4 border-b", className)} {...props} />;
}

export { HorizontalDivider };
