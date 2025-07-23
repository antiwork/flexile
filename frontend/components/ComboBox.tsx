import { PopoverTrigger } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import React, { useRef, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/utils";
import { Button } from "./ui/button";

const ComboBox = ({
  options,
  value,
  multiple,
  onChange,
  placeholder = "Select...",
  className,
  modal,
  ...props
}: { options: { value: string; label: string }[]; placeholder?: string; modal?: boolean } & (
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  | { multiple?: false; value: string | null | undefined; onChange: (value: string) => void }
) &
  Omit<React.ComponentProps<typeof Button>, "value" | "onChange">) => {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const getLabel = (value: string) => options.find((o) => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal || false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="small"
          role="combobox"
          aria-expanded={open}
          {...props}
          className={cn("justify-between", className)}
        >
          <div className="truncate">
            {value?.length ? (multiple ? value.map(getLabel).join(", ") : getLabel(value)) : placeholder}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <CommandInput
            placeholder="Search..."
            onValueChange={() => {
              requestAnimationFrame(() => {
                if (listRef.current) {
                  listRef.current.scrollTop = 0;
                }
              });
            }}
          />
          <CommandList ref={listRef}>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={(currentValue) => {
                    if (multiple) {
                      onChange(
                        value.includes(currentValue)
                          ? value.filter((v) => v !== currentValue)
                          : [...value, currentValue],
                      );
                    } else {
                      onChange(currentValue);
                      setOpen(false);
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      multiple
                        ? value.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                        : option.value === value
                          ? "opacity-100"
                          : "opacity-0",
                    )}
                  />
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

export default ComboBox;
