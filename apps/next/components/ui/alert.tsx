import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils";

const alertVariants = cva(
  "relative w-full rounded-xl px-4 py-3 [&>svg]:size-5 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-[calc(50%-10px)] [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-black",
        success: "bg-green text-white",
        critical: "bg-red text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = ({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) => (
  <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
);

const AlertTitle = ({ className, ...props }: React.ComponentProps<"h5">) => (
  <h5 className={cn("leading-none font-medium tracking-tight [&+div]:mt-1", className)} {...props} />
);

const AlertDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("[&_p]:leading-relaxed", className)} {...props} />
);

export { Alert, AlertDescription, AlertTitle };
