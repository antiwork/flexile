import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PayRateType, trpc } from "@/trpc/client";
import { useFormContext } from "react-hook-form";
import RadioButtons from "@/components/RadioButtons";
import NumberInput from "@/components/NumberInput";
import ComboBox from "@/components/ComboBox";
import { useCurrentCompany } from "@/global";

export default function FormFields() {
  const form = useFormContext();
  const payRateType: unknown = form.watch("payRateType");
  const company = useCurrentCompany();
  const [{ workers }] = trpc.contractors.list.useSuspenseQuery({
    companyId: company.id,
    excludeAlumni: true,
  });

  const uniqueRoles = Array.from(
    new Set(
      workers
        .filter((worker) => worker.role) // Filter out any undefined/null roles
        .map((worker) => worker.role),
    ),
  ).sort();

  const roleOptions = uniqueRoles.map((role) => ({
    label: role,
    value: role,
  }));

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
                value={field.value}
                onChange={field.onChange}
                options={roleOptions}
                placeholder="Select or type a role..."
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
                {...field}
                options={[
                  { label: "Hourly", value: PayRateType.Hourly } as const,
                  { label: "Project-based", value: PayRateType.ProjectBased } as const,
                  { label: "Salary", value: PayRateType.Salary } as const,
                ]}
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
                  value={field.value == null ? null : field.value / 100}
                  onChange={(value) => field.onChange(value == null ? null : value * 100)}
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
