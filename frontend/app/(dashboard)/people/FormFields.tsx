import { PopoverTrigger } from "@radix-ui/react-popover";
import { skipToken } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { useUserStore } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { cn } from "@/utils";

export const schema = z.object({
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number().nullable(),
  role: z.string(),
});

const RoleComboBox = ({
  value,
  onChange,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange">) => {
  const [isOpen, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const { data: workers } = trpc.contractors.list.useQuery(companyId ? { companyId, excludeAlumni: true } : skipToken);

  const trimmedQuery = searchQuery.trim();

  const availableRoles = useMemo(
    () =>
      [
        ...new Set([
          ...(workers?.map((worker) => worker.role) ?? []),
          "Software Engineer",
          "Designer",
          "Product Manager",
          "Data Analyst",
        ]),
      ].sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase())),
    [workers],
  );

  const filteredRoles = useMemo(
    () => availableRoles.filter((role) => role.toLowerCase().includes(trimmedQuery.toLowerCase())),
    [availableRoles, trimmedQuery],
  );

  const suggestions = useMemo(() => {
    const suggestions = [];
    if (trimmedQuery && !availableRoles.some((role) => role.toLowerCase() === trimmedQuery.toLowerCase()))
      suggestions.push(trimmedQuery);
    if (
      value &&
      value.toLowerCase() !== trimmedQuery.toLowerCase() &&
      !availableRoles.some((role) => role.toLowerCase() === value.toLowerCase())
    )
      suggestions.push(value);
    return suggestions;
  }, [trimmedQuery, availableRoles, value]);

  const handleSelect = (selectedRole: string) => {
    onChange(selectedRole);
    setOpen(false);
    setSearchQuery("");
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="small"
          role="combobox"
          aria-expanded={isOpen}
          {...props}
          className={cn("w-full min-w-0 justify-between", className)}
        >
          <div className="truncate">{value || "Select a role..."}</div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command value={value}>
          <CommandInput placeholder="Select or type a role..." value={searchQuery} onValueChange={handleSearchChange} />
          <CommandList ref={listRef}>
            {filteredRoles.length > 0 && (
              <CommandGroup heading="Available Roles">
                {filteredRoles.map((role) => (
                  <CommandItem key={role} value={role} onSelect={handleSelect}>
                    <Check className={cn("mr-2 h-4 w-4", role === value ? "opacity-100" : "opacity-0")} />
                    {role}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {suggestions.length > 0 && (
              <CommandGroup heading="Create New Role">
                {suggestions.map((role) => (
                  <CommandItem key={role} value={role} onSelect={handleSelect}>
                    <Check className={cn("mr-2 h-4 w-4", role === value ? "opacity-100" : "opacity-0")} />
                    {role}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function FormFields() {
  const form = useFormContext<z.infer<typeof schema>>();
  const payRateType = form.watch("payRateType");

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <RoleComboBox
                className="focus-visible:ring-ring focus-visible:border-border h-9 focus-visible:ring-2"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="payRateType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <FormControl>
              <RadioButtons
                className="grid-flow-col"
                {...field}
                options={[
                  { label: "Hourly", value: PayRateType.Hourly },
                  { label: "Custom", value: PayRateType.Custom },
                ]}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="payRateInSubunits"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rate</FormLabel>
            <FormControl>
              <NumberInput
                value={field.value == null ? null : field.value / 100}
                onChange={(value) => field.onChange(value == null ? null : value * 100)}
                placeholder="0"
                prefix="$"
                suffix={`/ ${payRateType === PayRateType.Custom ? "project" : "hour"}`}
                decimal
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
