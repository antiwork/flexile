import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PayRateType, trpc } from "@/trpc/client";
import { useFormContext } from "react-hook-form";
import NumberInput from "@/components/NumberInput";
import { useUserStore } from "@/global";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { skipToken } from "@tanstack/react-query";

export default function FormFields() {
  const form = useFormContext();
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const { data: workers } = trpc.contractors.list.useQuery(companyId ? { companyId, excludeAlumni: true } : skipToken);

  const uniqueRoles = workers ? [...new Set(workers.map((worker) => worker.role))].sort() : [];
  const roleRegex = new RegExp(`${form.watch("role")}`, "iu");

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Command shouldFilter={false} value={uniqueRoles.find((role) => roleRegex.test(role)) ?? ""}>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Input {...field} type="text" />
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <CommandList>
                    <CommandGroup>
                      {uniqueRoles.map((option) => (
                        <CommandItem key={option} value={option} onSelect={(e) => field.onChange(e)}>
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
            <FormLabel>Worker type</FormLabel>
            <div className="flex flex-col gap-2">
              {[
                { label: "Hourly", value: PayRateType.Hourly },
                { label: "Full-time", value: PayRateType.FullTime },
                { label: "Custom", value: PayRateType.Custom },
              ].map((option) => {
                const selected = String(field.value) === String(option.value);
                return (
                  <div key={option.label} className="rounded-md border border-gray-200">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm bg-white p-4 text-left"
                      onClick={() => {
                        field.onChange(option.value);
                        form.setValue("payRateInSubunits", null);
                      }}
                    >
                      <input type="checkbox" checked={selected} readOnly className="h-5 w-5 accent-blue-600" />
                      <span className="font-medium">{option.label}</span>
                    </button>

                    {selected && (
                      <div className="animate-fade-in rounded-b-sm bg-gray-50 p-4 pt-0">
                        <FormField
                          control={form.control}
                          name="payRateInSubunits"
                          render={({ field }) => (
                            <FormItem className="gap-0 pt-2">
                              <FormLabel>
                                {String(option.value) === String(PayRateType.Hourly)
                                  ? "Rate"
                                  : String(option.value) === String(PayRateType.FullTime)
                                    ? "Salary"
                                    : "Custom pay"}
                              </FormLabel>
                              <FormControl>
                                <NumberInput
                                  value={field.value == null ? null : field.value / 100}
                                  onChange={(value) => field.onChange(value == null ? null : value * 100)}
                                  placeholder="0"
                                  prefix="$"
                                  suffix={
                                    String(option.value) === String(PayRateType.Hourly)
                                      ? "/hour"
                                      : String(option.value) === String(PayRateType.FullTime)
                                        ? "/year"
                                        : ""
                                  }
                                  decimal
                                  className="bg-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
