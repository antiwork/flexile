"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formatISO } from "date-fns";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { MutationStatusButton } from "@/components/MutationButton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import RadioButtons from "@/components/RadioButtons";
import NumberInput from "@/components/NumberInput";
import DatePicker from "@/components/DatePicker";
import { PayRateType, trpc } from "@/trpc/client";
import { DEFAULT_WORKING_HOURS_PER_WEEK } from "@/models";

const formSchema = z
  .object({
    role: z.string().min(1, "Role is required"),
    payRateType: z.nativeEnum(PayRateType),
    payRateInSubunits: z.number().min(1, "Pay rate must be greater than 0"),
    hoursPerWeek: z.number().min(1, "Hours per week must be greater than 0").optional(),
    startDate: z.instanceof(CalendarDate),
  })
  .refine((data) => data.payRateType !== PayRateType.Hourly || data.hoursPerWeek !== undefined, {
    message: "Hours per week is required for hourly workers",
    path: ["hoursPerWeek"],
  });

type FormData = z.infer<typeof formSchema>;

interface WorkDetailsProps {
  onComplete: () => void;
}

export default function WorkDetails({ onComplete }: WorkDetailsProps) {
  const { companyId } = useParams<{ companyId: string }>();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "",
      payRateType: PayRateType.Hourly,
      payRateInSubunits: 0,
      hoursPerWeek: DEFAULT_WORKING_HOURS_PER_WEEK,
      startDate: today(getLocalTimeZone()),
    },
  });

  const payRateType = form.watch("payRateType");

  const updateWorkDetails = trpc.contractors.updateWorkDetails.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const submit = form.handleSubmit((values) => {
    updateWorkDetails.mutate({
      companyId,
      role: values.role,
      pay_rate_type: values.payRateType === PayRateType.Hourly ? "hourly" : "project_based",
      pay_rate_in_subunits: values.payRateInSubunits,
      hours_per_week: values.payRateType === PayRateType.Hourly ? values.hoursPerWeek : undefined,
      started_at: formatISO(values.startDate.toDate(getLocalTimeZone())),
    });
  });

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Product designer" autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DatePicker {...field} label="Start date" granularity="day" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payRateType"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Worker type</FormLabel>
              <FormControl>
                <RadioButtons
                  {...field}
                  options={[
                    { label: "Hourly", value: PayRateType.Hourly },
                    { label: "Full-time", value: PayRateType.ProjectBased },
                  ]}
                  aria-invalid={!!fieldState.error}
                  className="grid-flow-row"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div
          className={`grid items-start gap-3 ${payRateType === PayRateType.ProjectBased ? "md:grid-cols-1" : "md:grid-cols-2"}`}
        >
          <FormField
            control={form.control}
            name="payRateInSubunits"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate</FormLabel>
                <FormControl>
                  <NumberInput
                    value={field.value ? field.value / 100 : null}
                    onChange={(value) => field.onChange(value ? value * 100 : null)}
                    placeholder="0"
                    prefix="$"
                    suffix={payRateType === PayRateType.ProjectBased ? "/ project" : "/ hour"}
                    decimal
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {payRateType === PayRateType.Hourly && (
            <FormField
              control={form.control}
              name="hoursPerWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours per week</FormLabel>
                  <FormControl>
                    <NumberInput value={field.value} onChange={field.onChange} placeholder="20" suffix="hours" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <MutationStatusButton className="mt-4" type="submit" mutation={updateWorkDetails}>
          Continue
        </MutationStatusButton>
      </form>
    </Form>
  );
}
