import React from "react";
import { CalendarIcon } from "lucide-react";
import {
  DatePicker as RacDatePicker,
  Button as RacButton,
  Dialog as RacDialog,
  Group,
  Label as RacLabel,
  Popover as RacPopover,
} from "react-aria-components";
import type { DatePickerProps as RacDatePickerProps, DateValue } from "react-aria-components";

import { Calendar } from "@/components/ui/calendar";
import { DateInput } from "@/components/ui/datefield";
import { cn } from "@/utils";

interface DatePickerProps extends Omit<RacDatePickerProps<DateValue>, "children"> {
  label: string;
  className?: string;
}

export default function DatePicker({ label, className, ...props }: DatePickerProps) {
  return (
    <RacDatePicker {...props} className={cn(className, "*:not-first:mt-2")}>
      <RacLabel className="text-foreground text-base">{label}</RacLabel>
      <div className="flex">
        <Group className="w-full">
          <DateInput className="pe-9" />
        </Group>
        <RacButton className="text-muted-foreground/80 hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-ring/15 z-10 -ms-9 -me-px flex w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none data-focus-visible:ring-[3px]">
          <CalendarIcon size={16} />
        </RacButton>
      </div>
      <RacPopover
        placement="bottom end"
        className="bg-background text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-lg border shadow-lg outline-hidden"
      >
        <RacDialog className="max-h-[inherit] overflow-auto p-2">
          <Calendar />
        </RacDialog>
      </RacPopover>
    </RacDatePicker>
  );
}
