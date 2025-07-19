"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { countries } from "@/models/constants";
import { cn } from "@/utils";

export const CountrySelector = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const countryOptions = [...countries].map(([code, name]) => ({ value: code, label: name }));
  const getLabel = (value: string) => countryOptions.find((o) => o.value === value)?.label;

  const filteredOptions = searchValue
    ? countryOptions.filter(
        (option) =>
          option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
          option.value.toLowerCase().includes(searchValue.toLowerCase()),
      )
    : countryOptions;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="small" role="combobox" aria-expanded={open} className="justify-between">
          <div className="truncate">{value ? getLabel(value) : placeholder}</div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={searchValue} onValueChange={setSearchValue} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
