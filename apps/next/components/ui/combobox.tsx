"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  portalContainer?: HTMLElement | null;
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
  portalContainer,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm",
            "ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50",
            "peer",
            triggerClassName,
          )}
          disabled={disabled}
        >
          {value ? options.find((option) => option.value === value)?.label || placeholder : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", popoverClassName)}
      >
        <Command className={className}>
          <CommandInput placeholder={placeholder} value={searchValue} onValueChange={setSearchValue} />
          <CommandList>
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
                  <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
