import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import React from "react";
import {
  Button as RacButton,
  DatePicker as RacDatePicker,
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
  label?: string;
  className?: string;
  variant?: "default" | "trigger";
}

export default function DatePicker({ label, className, variant = "default", ...props }: DatePickerProps) {
  function renderDefaultPicker() {
    return (
      <div className="flex">
        <Group className="w-full">
          <DateInput className="pe-9" />
        </Group>
        <RacButton className="text-muted-foreground/80 hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-ring/15 z-10 -ms-9 -me-px flex w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none data-focus-visible:ring-[3px]">
          <CalendarIcon size={16} />
        </RacButton>
      </div>
    );
  }

  function renderTriggerPicker() {
    const value = props.value ?? null;

    return (
      <Group className="bg-background border-input focus-within:border-ring focus-within:ring-ring/15 flex overflow-hidden rounded-md border whitespace-nowrap transition-[color,box-shadow] focus-within:ring-[3px]">
        <RacButton className="flex cursor-pointer items-center gap-2 px-3 py-2">
          <CalendarIcon size={16} />
          {value ? <span>{format(value.toDate("UTC"), "MMM d")}</span> : <span>Select date</span>}
        </RacButton>
      </Group>
    );
  }

  return (
    <RacDatePicker {...props} className={cn(className, "*:not-first:mt-2")}>
      {label ? <RacLabel className="text-foreground text-base">{label}</RacLabel> : null}
      {variant === "default" ? renderDefaultPicker() : renderTriggerPicker()}
      <RacPopover
        placement="bottom end"
        className="bg-background text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 pointer-events-auto rounded-lg border shadow-lg outline-hidden"
      >
        <RacDialog className="max-h-[inherit] overflow-auto p-2">
          <Calendar />
        </RacDialog>
      </RacPopover>
    </RacDatePicker>
  );
}
