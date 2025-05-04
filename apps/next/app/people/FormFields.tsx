import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PayRateType } from "@/trpc/client";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import RadioButtons from "@/components/RadioButtons";
import NumberInput from "@/components/NumberInput";
import { useCurrentCompany } from "@/global";

export default function FormFields() {
  const company = useCurrentCompany();
  const form = useFormContext();
  const payRateType: unknown = form.watch("payRateType");

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <Input {...field} />
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
                {...field}
                options={[
                  { label: "Hourly", value: PayRateType.Hourly } as const,
                  { label: "Project-based", value: PayRateType.ProjectBased } as const,
                  company.flags.includes("salary_roles")
                    ? ({ label: "Salary", value: PayRateType.Salary } as const)
                    : null,
                ].filter((option) => !!option)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="payRateInSubunits"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rate</FormLabel>
              <FormControl>
                <NumberInput
                  {...field}
                  placeholder="0"
                  prefix="$"
                  suffix={
                    payRateType === PayRateType.ProjectBased
                      ? "/ project"
                      : payRateType === PayRateType.Salary
                        ? "/ year"
                        : "/ hour"
                  }
                  decimal
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {payRateType !== PayRateType.ProjectBased && (
          <FormField
            control={form.control}
            name="hoursPerWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Average hours</FormLabel>
                <FormControl>
                  <NumberInput {...field} suffix="/ week" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </>
  );
}
