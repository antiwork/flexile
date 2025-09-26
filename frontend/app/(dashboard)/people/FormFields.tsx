import { skipToken } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserStore } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { cn } from "@/utils";

export const schema = z.object({
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number().nullable(),
  role: z.string(),
});

const defaultRoles = ["Software Engineer", "Designer", "Product Manager", "Data Analyst"];

export default function FormFields() {
  const form = useFormContext<z.infer<typeof schema>>();
  const payRateType = form.watch("payRateType");
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const { data: workers } = trpc.contractors.list.useQuery(companyId ? { companyId, excludeAlumni: true } : skipToken);

  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const roleValue = form.getValues("role");
  const availableRoles = [...new Set([...(workers?.map((worker) => worker.role) ?? []), ...defaultRoles])].sort(
    (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const filteredRoles = availableRoles.filter((role) => role.toLowerCase().includes(trimmedQuery.toLowerCase()));

  const suggestions: string[] = [];
  if (trimmedQuery && !availableRoles.some((role) => role.toLowerCase() === trimmedQuery.toLowerCase()))
    suggestions.push(trimmedQuery);
  if (roleValue !== trimmedQuery && !availableRoles.some((role) => role.toLowerCase() === roleValue.toLowerCase()))
    suggestions.push(roleValue);

  const handleSelect = (selectedRole: string) => {
    form.setValue("role", selectedRole);
    setRolePopoverOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => {
          const popoverId = `${field.name}-popover`;
          return (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Popover open={rolePopoverOpen} onOpenChange={setRolePopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      {...field}
                      aria-controls={rolePopoverOpen ? popoverId : undefined}
                      aria-expanded={rolePopoverOpen}
                      aria-haspopup="listbox"
                      className="border-input focus-visible:ring-ring focus-visible:border-border aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-9 w-full min-w-0 justify-between outline-none focus-visible:ring-2 focus-visible:outline-hidden dark:bg-transparent"
                      role="combobox"
                      size="small"
                      variant="outline"
                    >
                      <div className="truncate">{field.value || "Select or type a role..."}</div>
                      <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  aria-label={`${field.name} options`}
                  id={popoverId}
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                  role="listbox"
                >
                  <Command value={field.value}>
                    <CommandInput
                      placeholder="Select or type a role..."
                      value={searchQuery}
                      onValueChange={(query: string) => {
                        setSearchQuery(query);
                      }}
                    />
                    <CommandList>
                      {filteredRoles.length > 0 && (
                        <CommandGroup heading="Available Roles">
                          {filteredRoles.map((role) => (
                            <CommandItem key={role} value={role} onSelect={handleSelect}>
                              <Check
                                className={cn("mr-2 h-4 w-4", role === field.value ? "opacity-100" : "opacity-0")}
                              />
                              {role}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {suggestions.length > 0 && (
                        <CommandGroup heading="Create New Role">
                          {suggestions.map((role) => (
                            <CommandItem key={role} value={role} onSelect={handleSelect}>
                              <Check
                                className={cn("mr-2 h-4 w-4", role === field.value ? "opacity-100" : "opacity-0")}
                              />
                              {role}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }}
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
