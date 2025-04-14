import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center px-4 border rounded-full gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 [&[inert]]:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-black text-white border-black hover:bg-blue-600 hover:border-blue-600",
        primary: "bg-blue-600 text-white border-blue-600 hover:bg-black hover:border-black",
        critical: "bg-red text-white border-red",
        success: "bg-green text-white border-green",
        outline: "bg-transparent text-inherit border-current hover:text-blue-600",
        dashed: "bg-transparent text-inherit border-dashed border-current hover:text-blue-600",
        link: "gap-1 border-none underline hover:text-blue-600 !py-0 justify-start px-0",
      },
      size: {
        default: "py-2",
        small: "py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp type="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
