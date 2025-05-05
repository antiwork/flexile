"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  const toasterStyle: React.CSSProperties & Record<string, string> = {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
  };

  return (
    <Sonner
      theme={theme === "system" ? "system" : theme === "dark" ? "dark" : "light"}
      className="toaster group"
      style={toasterStyle}
      {...props}
    />
  );
};

export { Toaster };
