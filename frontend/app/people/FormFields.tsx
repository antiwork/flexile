import { skipToken } from "@tanstack/react-query";
import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useUserStore } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";

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
  const roleRegex = new RegExp(form.watch("role"), "iu");
  const filteredRoles = workers
    ? [...new Set(workers.map((worker) => worker.role))].sort().filter((value) => roleRegex.test(value))
    : defaultRoles;

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Command shouldFilter={false}>
              <Popover open={!!rolePopoverOpen && filteredRoles.length > 0}>
                <PopoverAnchor asChild>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      autoComplete="off"
                      onFocus={() => setRolePopoverOpen(true)}
                      onBlur={() => setRolePopoverOpen(false)}
                      onChange={(e) => {
                        field.onChange(e);
                        setRolePopoverOpen(true);
                      }}
                    />
                  </FormControl>
                </PopoverAnchor>
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <CommandList>
                    <CommandGroup>
                      {filteredRoles.map((option) => (
                        <CommandItem
                          key={option}
                          value={option}
                          onSelect={(e) => {
                            field.onChange(e);
                            setRolePopoverOpen(false);
                          }}
                        >
                          {option}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </PopoverContent>
              </Popover>
            </Command>
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
