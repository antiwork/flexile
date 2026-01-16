"use client";

import { InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import greenCheckmark from "@/images/green-checkmark.svg";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  const successElement = <Image src={greenCheckmark} alt="checkmark" width={20} height={20} />,
    toastStyle: React.CSSProperties & Record<`--${string}`, string> = {
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--border-radius": "var(--radius)",
    };

  return (
    <Sonner
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      theme={(theme as ToasterProps["theme"]) ?? "system"}
      className="toaster group"
      icons={{
        success: successElement,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={toastStyle}
      position="top-center"
      {...props}
    />
  );
};

export { Toaster };
