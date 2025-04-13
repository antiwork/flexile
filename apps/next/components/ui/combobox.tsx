"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils";

interface ComboboxProps {
  options: { value: string; label: string }[];
  value?: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = "Select an option",
  emptyMessage = "No results found.",
  className,
  popoverClassName,
  disabled = false,
  triggerClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          className={cn(
            "border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName,
          )}
          disabled={disabled}
        >
          {value ? options.find((option) => option.value === value)?.label || placeholder : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[200px] p-0", popoverClassName)}>
        <Command className={className}>
          <CommandInput placeholder={placeholder} value={searchValue} onValueChange={setSearchValue} />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={(currentValue) => {
                  onSelect(currentValue);
                  setOpen(false);
                  setSearchValue("");
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
