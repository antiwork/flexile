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

const defaultOnboardingRoles = ["Software Engineer", "Designer", "Product Manager", "Data Analyst"];

export default function FormFields() {
  const form = useFormContext<z.infer<typeof schema>>();
  const payRateType = form.watch("payRateType");
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const { data: workers } = trpc.contractors.list.useQuery(companyId ? { companyId, excludeAlumni: true } : skipToken);

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const roleValue = form.getValues("role");

  const roleSet = new Set(workers ? workers.map((worker) => worker.role) : defaultOnboardingRoles);
  if (trimmedQuery) roleSet.add(trimmedQuery);
  if (roleValue) roleSet.add(roleValue);

  const availableRoles = Array.from(roleSet)
    .sort((a, b) => new Intl.Collator(undefined, { sensitivity: "base" }).compare(a, b))
    .map((role) => ({ label: role, value: role }));

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
                onChange={field.onChange}
                onSearchChange={setSearchQuery}
                options={availableRoles}
                placeholder="Search or enter a role..."
                searchPlaceholder="Search or enter a role..."
                searchValue={searchQuery}
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
