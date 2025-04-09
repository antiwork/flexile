import { Slot } from "@radix-ui/react-slot";
import React from "react";
import { linkClasses } from "./Link";
import { cn } from "../utils";

const Button = ({
  children,
  className,
  variant,
  small,
  asChild,
  ...props
}: {
  variant?: "primary" | "critical" | "success" | "outline" | "dashed" | "link" | undefined;
  small?: boolean | undefined;
  asChild?: boolean | undefined;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const classes = (() => {
    if (variant === "link") return linkClasses;

    let classes =
      "inline-flex items-center justify-center px-4 border rounded-full gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 [&[inert]]:opacity-50 disabled:pointer-events-none";
    classes += small ? " py-1" : " py-2";

    if (variant) {
      switch (variant) {
        case "primary":
          return `${classes} bg-blue-600 text-white border-blue-600 hover:bg-black hover:border-black`;
        case "critical":
          return `${classes} bg-red text-white border-red`;
        case "success":
          return `${classes} bg-green text-white border-green`;
        case "outline":
          return `${classes} bg-transparent text-inherit border-current hover:text-blue-600`;
        case "dashed":
          return `${classes} bg-transparent text-inherit border-dashed border-current hover:text-blue-600`;
      }
    } else {
      return `${classes} bg-black text-white border-black hover:bg-blue-600 hover:border-blue-600`;
    }
  })();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp type="button" {...props} className={cn(classes, className)}>
      {children}
    </Comp>
  );
};

export default Button;
