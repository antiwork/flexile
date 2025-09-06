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
import { DateDisplay, DateInput } from "@/components/ui/datefield";
import { cn } from "@/utils";

interface DatePickerProps extends Omit<RacDatePickerProps<DateValue>, "children"> {
  label?: string;
  className?: string;
  variant?: "default" | "trigger";
}

export default function DatePicker({ label, className, variant = "default", ...props }: DatePickerProps) {
  return (
    <RacDatePicker {...props} className={cn(className, "*:not-first:mt-2")}>
      {label ? <RacLabel className="text-foreground text-base">{label}</RacLabel> : null}
      <Group className="bg-background hover:text-foreground border-input focus-within:border-ring focus-within:ring-ring/15 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-full overflow-hidden rounded-md border px-3 py-2 whitespace-nowrap transition-[color,box-shadow] focus-within:ring-[3px]">
        {variant === "trigger" && (
          <RacButton className="flex w-full cursor-pointer items-center gap-2">
            <CalendarIcon size={16} />
            <DateDisplay value={props.value ?? null} />
          </RacButton>
        )}
        {variant === "default" && (
          <div className="flex items-center gap-2">
            <DateInput />
            <RacButton>
              <CalendarIcon size={16} />
            </RacButton>
          </div>
        )}
      </Group>
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
