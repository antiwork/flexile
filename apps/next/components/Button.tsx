// import { Slot } from "@radix-ui/react-slot";
// import React from "react";
// import { linkClasses } from "@/components/Link";
// import { cn } from "@/utils";

// const Button = ({
//   children,
//   className,
//   variant,
//   small,
//   asChild,
//   ...props
// }: {
//   variant?: "primary" | "critical" | "success" | "outline" | "dashed" | "link" | undefined;
//   small?: boolean | undefined;
//   asChild?: boolean | undefined;
// } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
//   const classes = (() => {
//     if (variant === "link") return linkClasses;

//     let classes =
//       "inline-flex items-center justify-center px-4 border rounded-full gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 [&[inert]]:opacity-50 disabled:pointer-events-none";
//     classes += small ? " py-1" : " py-2";

//     if (variant) {
//       switch (variant) {
//         case "primary":
//           return `${classes} bg-blue-600 text-white border-blue-600 hover:bg-black hover:border-black`;
//         case "critical":
//           return `${classes} bg-red text-white border-red`;
//         case "success":
//           return `${classes} bg-green text-white border-green`;
//         case "outline":
//           return `${classes} bg-transparent text-inherit border-current hover:text-blue-600`;
//         case "dashed":
//           return `${classes} bg-transparent text-inherit border-dashed border-current hover:text-blue-600`;
//       }
//     } else {
//       return `${classes} bg-black text-white border-black hover:bg-blue-600 hover:border-blue-600`;
//     }
//   })();
//   const Comp = asChild ? Slot : "button";

//   return (
//     <Comp type="button" {...props} className={cn(classes, className)}>
//       {children}
//     </Comp>
//   );
// };

// export default Button;

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-blue-600 text-white border-blue-600 hover:bg-black hover:border-black",
        critical: "bg-red text-white border-red",
        success: "bg-green text-white border-green",
        outline: "border border-input bg-transparent text-inherit hover:text-blue-600",
        dashed: "border-dashed border-current bg-transparent text-inherit hover:text-blue-600",
        link: "text-primary underline-offset-4 hover:underline",
        default: "bg-black text-white border-black hover:bg-blue-600 hover:border-blue-600",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3 text-xs",
        lg: "h-10 rounded-full px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  small?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, small, asChild = false, size, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size: small ? "sm" : size }), className)} ref={ref} {...props} />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;
