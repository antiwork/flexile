import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils/index";

const buttonVariants = cva(
  "inline-flex items-center justify-center px-3 border rounded-md gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 [&[inert]]:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800",
        primary: "bg-blue-600 text-white border-blue-600 hover:bg-blue-500 hover:border-blue-500",
        critical: "bg-red text-white border-red hover:bg-red-700 hover:border-red-700",
        success: "bg-green text-white border-green",
        outline: "bg-transparent text-inherit border-muted hover:bg-accent",
        destructive: "bg-transparent text-inherit border-muted hover:text-destructive hover:*:text-destructive",
        dashed: "bg-transparent text-inherit border-dashed border-current hover:text-blue-600",
        ghost: "border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "gap-1 border-none hover:text-blue-600 hover:underline !py-0 justify-start px-0",
        "floating-action":
          "fixed right-4 bottom-18 z-30 size-14 rounded-full border-blue-600 bg-blue-600 px-2 text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.1),0px_1px_3px_0px_rgba(0,0,0,0.1)] hover:border-blue-500 hover:bg-blue-500 disabled:pointer-events-auto [&_svg]:size-6",
      },
      size: {
        default: "py-2",
        small: "py-1.25",
        icon: "size-10",
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
