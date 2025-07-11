import React, { useCallback, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandGroup, CommandItem, CommandList, CommandEmpty } from "./command";
import { Input } from "./input";

interface InputSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export default function InputSelect({ value, onChange, options, placeholder = "Select or type" }: InputSelectProps) {
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!value) return options;
    return options.filter((option) => option.toLowerCase().includes(value.toLowerCase()));
  }, [value, options]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          type="text"
        />
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {filteredOptions.length > 0 ? (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem key={option} value={option} onSelect={handleSelect}>
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : value ? (
              <div className="text-muted-foreground px-2 py-6 text-center text-sm">Use "{value}"</div>
            ) : (
              <CommandEmpty>No existing values found</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
