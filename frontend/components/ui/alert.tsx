import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils";

const alertVariants = cva(
  "relative rounded-md px-2.5 py-2 text-foreground grid has-[>svg]:grid-cols-[auto_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-2 gap-y-0.5 [&>svg]:size-5 [&>svg]:text-current [&>svg]:self-center [&>svg]:[align-self:anchor-center] flex-row flex-wrap [&:not(:has(>div[data-slot=alert-title]))]:items-start",
  {
    variants: {
      variant: {
        default: "bg-info-foreground [&>svg]:text-info",
        destructive: "bg-destructive-foreground [&>svg]:text-destructive",
        warning: "bg-warning-foreground [&>svg]:text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-base [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
