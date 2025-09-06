import { format } from "date-fns";
import React from "react";
import {
  composeRenderProps,
  DateField as DateFieldRac,
  DateInput as DateInputRac,
  DateSegment as DateSegmentRac,
  TimeField as TimeFieldRac,
} from "react-aria-components";
import type {
  DateFieldProps,
  DateInputProps as DateInputPropsRac,
  DateSegmentProps,
  DateValue as DateValueRac,
  TimeFieldProps,
  TimeValue as TimeValueRac,
} from "react-aria-components";
import { cn } from "@/utils";

function DateField<T extends DateValueRac>({ className, children, ...props }: DateFieldProps<T>) {
  return (
    <DateFieldRac className={composeRenderProps(className, (className) => cn(className))} {...props}>
      {children}
    </DateFieldRac>
  );
}

function TimeField<T extends TimeValueRac>({ className, children, ...props }: TimeFieldProps<T>) {
  return (
    <TimeFieldRac className={composeRenderProps(className, (className) => cn(className))} {...props}>
      {children}
    </TimeFieldRac>
  );
}

function DateSegment({ className, ...props }: DateSegmentProps) {
  return (
    <DateSegmentRac
      className={composeRenderProps(className, (className) =>
        cn(
          "text-foreground data-focused:bg-accent data-invalid:data-focused:bg-destructive data-focused:data-placeholder:text-foreground data-focused:text-foreground data-invalid:data-placeholder:text-destructive data-invalid:text-destructive data-placeholder:text-muted-foreground/70 data-[type=literal]:text-muted-foreground/70 inline rounded p-0.5 caret-transparent outline-hidden data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:data-focused:text-white data-invalid:data-focused:data-placeholder:text-white data-[type=literal]:px-0",
          className,
        ),
      )}
      {...props}
      data-invalid
    />
  );
}

interface DateInputProps extends DateInputPropsRac {
  className?: string;
}

function DateInput({ className, ...props }: Omit<DateInputProps, "children">) {
  return (
    <DateInputRac className={cn(className)} {...props}>
      {(segment) => <DateSegment segment={segment} />}
    </DateInputRac>
  );
}

function DateDisplay({ value }: { value: DateValueRac | null }) {
  if (!value) return <span>Select date</span>;

  const date = value.toDate("UTC");
  return <span>{format(date, "MMM d")}</span>; // e.g., "Aug 5"
}

export { DateDisplay, DateField, DateInput, DateSegment, TimeField };
export type { DateInputProps };
