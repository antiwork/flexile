import { skipToken } from "@tanstack/react-query";
import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import NumberInput from "@/components/NumberInput";
import RadioButtons from "@/components/RadioButtons";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const roleValue = form.getValues("role");
  const availableRoles = [...(workers ? new Set(workers.map((worker) => worker.role)) : defaultRoles)];

  if (trimmedQuery && !availableRoles.some((role) => role === trimmedQuery)) availableRoles.push(trimmedQuery);
  if (roleValue && roleValue !== trimmedQuery && !availableRoles.some((role) => role === roleValue))
    availableRoles.push(roleValue);

  availableRoles.sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()));

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <ComboBox
                {...field}
                options={availableRoles.map((role) => ({ label: role, value: role }))}
                onChange={(value) => {
                  field.onChange(value);
                  setSearchQuery("");
                }}
                placeholder="Search or enter a role..."
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search or enter a role..."
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
