import { useCallback, useMemo, useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PayRateType, trpc } from "@/trpc/client";
import { useFormContext } from "react-hook-form";
import RadioButtons from "@/components/RadioButtons";
import NumberInput from "@/components/NumberInput";
import { useUserStore } from "@/global";
import { skipToken } from "@tanstack/react-query";
import { z } from "zod";
import { Command, CommandGroup, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export const schema = z.object({
  payRateType: z.nativeEnum(PayRateType),
  payRateInSubunits: z.number().nullable(),
  role: z.string(),
});

export default function FormFields() {
  const form = useFormContext<z.infer<typeof schema>>();
  const payRateType = form.watch("payRateType");
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const { data: workers } = trpc.contractors.list.useQuery(companyId ? { companyId, excludeAlumni: true } : skipToken);

  const uniqueRoles = workers ? [...new Set(workers.map((worker) => worker.role))].sort() : [];

  return (
    <>
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <RoleSelect {...field} options={uniqueRoles} />
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

interface RoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

function RoleSelect({ value, onChange, options }: RoleSelectProps) {
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
          onChange={(e) => onChange(e.target.value)}
          onClick={() => setOpen(true)}
          placeholder="Select or type a role"
          type="text"
          name="role"
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
