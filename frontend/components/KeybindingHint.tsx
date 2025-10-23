"use client";
import * as React from "react";
import { detectPlatform } from "@/lib/platform";
import { cn } from "@/utils";

type Props = {
  className?: string;
};

export function PrimarySubmitHint({ className }: Props) {
  const isApple = React.useMemo(() => detectPlatform() === "apple", []);
  const modGlyph = isApple ? "⌘" : "⌃";
  const srMod = isApple ? "Command" : "Control";

  return (
    <span className={cn("text-muted-foreground text-sm", className)}>
      <span className="sr-only">({srMod} plus Enter)</span>
      <kbd className="inline-flex gap-1 align-middle leading-none ...">
        <span className="text-xs leading-none opacity-90">{modGlyph}</span>
        <span className="translate-y-[1px] leading-none">⏎</span>
      </kbd>
    </span>
  );
}

export default PrimarySubmitHint;
