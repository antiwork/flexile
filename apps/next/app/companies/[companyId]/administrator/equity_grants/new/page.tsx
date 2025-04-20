"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { optionGrantTypeDisplayNames, relationshipDisplayNames, vestingTriggerDisplayNames } from "@/app/equity/grants";
import ComboBox from "@/components/ComboBox";
import FormSection from "@/components/FormSection";
import MainLayout from "@/components/layouts/Main";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";

const MAX_VESTING_DURATION_IN_MONTHS = 120;

// type IssueDateRelationship = keyof typeof relationshipDisplayNames;
// type OptionGrantType = keyof typeof optionGrantTypeDisplayNames;
// type VestingTrigger = keyof typeof vestingTriggerDisplayNames;

const vestingFrequencyOptions = [
  { label: "Monthly", value: "1" },
  { label: "Quarterly", value: "3" },
  { label: "Annually", value: "12" },
];

function isLiteralValue<T extends Record<string, unknown>>(
  value: string, 
  obj: T
): value is keyof T {
  return Object.keys(obj).includes(value);
}

const formSchema = z.object({
  contractor: z.string().min(1, "Must be present."),
  option_pool: z.string().min(1, "Must be present."),
  number_of_shares: z.number().gt(0, "Must be present and greater than 0."),
  issue_date_relationship: z.enum(Object.keys(relationshipDisplayNames) as [string, ...string[]], {
    required_error: "Must be present.",
  }),
  option_grant_type: z.enum(Object.keys(optionGrantTypeDisplayNames) as [string, ...string[]], {
    required_error: "Must be present.",
  }),
  expires_at: z.number().min(0, "Must be present and greater than or equal to 0."),
  vesting_trigger: z.enum(Object.keys(vestingTriggerDisplayNames) as [string, ...string[]], {
    required_error: "Must be present.",
  }),
  vesting_schedule_id: z.string().optional(),
  vesting_commencement_date: z.string().optional(),
  total_vesting_duration_months: z.number().nullable(),
  cliff_duration_months: z.number().nullable(),
  vesting_frequency_months: z.string().nullable(),
  voluntary_termination_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
  involuntary_termination_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
  termination_with_cause_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
  death_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
  disability_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
  retirement_exercise_months: z.number().min(0, "Must be present and greater than or equal to 0."),
});

interface OptionPool {
  id: string;
  name: string;
  availableShares: number;
}

type FormValues = z.infer<typeof formSchema>;

// interface FormContext {
//   optionPools: OptionPool[];
// }

const formSchemaWithRefinements = formSchema
  .refine(
    (data, ctx) => {
      interface ZodContext {
        optionPools?: OptionPool[];
      }
      const context = ctx.contextualErrorMap ? ctx : { optionPools: [] };
      const optionPools = 'optionPools' in context ? context.optionPools : undefined;
      
      if (!data.option_pool || !optionPools) return true;
      
      const optionPool = optionPools.find((pool) => pool.id === data.option_pool);
      if (!optionPool) return true;
      
      return optionPool.availableShares >= data.number_of_shares;
    },
    {
      message: "Not enough shares available in the option pool to create a grant with this number of options.",
      path: ["number_of_shares"],
    },
  )
  .refine(
    (data) =>
      data.option_grant_type !== "iso" ||
      data.issue_date_relationship === "employee" ||
      data.issue_date_relationship === "founder",
    {
      message: "ISOs can only be issued to employees or founders.",
      path: ["option_grant_type"],
    },
  )
  .refine(
    (data) => {
      if (data.vesting_trigger === "scheduled") {
        return !!data.vesting_schedule_id;
      }
      return true;
    },
    {
      message: "Must be present.",
      path: ["vesting_schedule_id"],
    },
  )
  .refine(
    (data) => {
      if (data.vesting_trigger === "scheduled") {
        return !!data.vesting_commencement_date;
      }
      return true;
    },
    {
      message: "Must be present.",
      path: ["vesting_commencement_date"],
    },
  )
  .refine(
    (data) => {
      if (data.vesting_trigger === "scheduled" && data.vesting_schedule_id === "custom") {
        return !!data.total_vesting_duration_months && data.total_vesting_duration_months > 0;
      }
      return true;
    },
    {
      message: "Must be present and greater than 0.",
      path: ["total_vesting_duration_months"],
    },
  )
  .refine(
    (data) => {
      if (
        data.vesting_trigger === "scheduled" &&
        data.vesting_schedule_id === "custom" &&
        data.total_vesting_duration_months
      ) {
        return data.total_vesting_duration_months <= MAX_VESTING_DURATION_IN_MONTHS;
      }
      return true;
    },
    {
      message: `Must not be more than ${MAX_VESTING_DURATION_IN_MONTHS} months (${MAX_VESTING_DURATION_IN_MONTHS / 12} years).`,
      path: ["total_vesting_duration_months"],
    },
  )
  .refine(
    (data) => {
      if (data.vesting_trigger === "scheduled" && data.vesting_schedule_id === "custom") {
        return data.cliff_duration_months !== null && data.cliff_duration_months >= 0;
      }
      return true;
    },
    {
      message: "Must be present and greater than or equal to 0.",
      path: ["cliff_duration_months"],
    },
  )
  .refine(
    (data) => {
      if (
        data.vesting_trigger === "scheduled" &&
        data.vesting_schedule_id === "custom" &&
        data.cliff_duration_months !== null &&
        data.total_vesting_duration_months !== null
      ) {
        return data.cliff_duration_months < data.total_vesting_duration_months;
      }
      return true;
    },
    {
      message: "Must be less than total vesting duration.",
      path: ["cliff_duration_months"],
    },
  )
  .refine(
    (data) => {
      if (data.vesting_trigger === "scheduled" && data.vesting_schedule_id === "custom") {
        return !!data.vesting_frequency_months;
      }
      return true;
    },
    {
      message: "Must be present.",
      path: ["vesting_frequency_months"],
    },
  )
  .refine(
    (data) => {
      if (
        data.vesting_trigger === "scheduled" &&
        data.vesting_schedule_id === "custom" &&
        data.vesting_frequency_months &&
        data.total_vesting_duration_months
      ) {
        return Number(data.vesting_frequency_months) <= data.total_vesting_duration_months;
      }
      return true;
    },
    {
      message: "Must be less than total vesting duration.",
      path: ["vesting_frequency_months"],
    },
  );

export default function NewEquityGrant() {
  const today = assertDefined(new Date().toISOString().split("T")[0]);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.new.useSuspenseQuery({
    companyId: company.id,
  });

  const recipientOptions = useMemo(
    () =>
      data.workers
        .sort((a, b) => a.user.name.localeCompare(b.user.name))
        .map((worker) => ({ label: worker.user.name, value: worker.id })),
    [data.workers],
  );
  const optionPoolOptions = useMemo(
    () =>
      data.optionPools.map((optionPool) => ({
        label: optionPool.name,
        value: optionPool.id,
      })),
    [data.optionPools],
  );
  const vestingScheduleOptions = [
    ...data.defaultVestingSchedules.map((schedule) => ({
      label: schedule.name,
      value: schedule.id,
    })),
    { label: "Custom", value: "custom" },
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchemaWithRefinements),
    defaultValues: {
      contractor: "",
      option_pool: data.optionPools.length === 1 ? data.optionPools[0]?.id : "",
      number_of_shares: 0,
      issue_date_relationship: undefined,
      option_grant_type: "nso",
      expires_at: null,
      vesting_trigger: undefined,
      vesting_schedule_id: undefined,
      vesting_commencement_date: today,
      total_vesting_duration_months: null,
      cliff_duration_months: null,
      vesting_frequency_months: null,
      voluntary_termination_exercise_months: null,
      involuntary_termination_exercise_months: null,
      termination_with_cause_exercise_months: null,
      death_exercise_months: null,
      disability_exercise_months: null,
      retirement_exercise_months: null,
    },
    context: {
      optionPools: data.optionPools,
    },
  });

  const recipientId = form.watch("contractor");
  const optionPoolId = form.watch("option_pool");
  const issueDateRelationship = form.watch("issue_date_relationship");
  const _grantType = form.watch("option_grant_type");
  const vestingTrigger = form.watch("vesting_trigger");
  const vestingScheduleId = form.watch("vesting_schedule_id");

  const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
  const recipient = data.workers.find(({ id }) => id === recipientId);

  useEffect(() => {
    if (!recipientId) return;

    if (recipient?.salaried) {
      form.setValue("option_grant_type", "iso");
      form.setValue("issue_date_relationship", "employee");
    } else {
      const lastGrant = recipient?.lastGrant;
      form.setValue("option_grant_type", lastGrant?.optionGrantType ?? "nso");
      form.setValue("issue_date_relationship", lastGrant?.issueDateRelationship);
    }
  }, [recipientId, recipient, form]);

  useEffect(() => {
    if (!optionPool) return;

    form.setValue("expires_at", optionPool.defaultOptionExpiryMonths);
    form.setValue("voluntary_termination_exercise_months", optionPool.voluntaryTerminationExerciseMonths);
    form.setValue("involuntary_termination_exercise_months", optionPool.involuntaryTerminationExerciseMonths);
    form.setValue("termination_with_cause_exercise_months", optionPool.terminationWithCauseExerciseMonths);
    form.setValue("death_exercise_months", optionPool.deathExerciseMonths);
    form.setValue("disability_exercise_months", optionPool.disabilityExerciseMonths);
    form.setValue("retirement_exercise_months", optionPool.retirementExerciseMonths);
  }, [optionPoolId, optionPool, form]);

  useEffect(() => {
    form.setValue(
      "vesting_trigger",
      !issueDateRelationship
        ? undefined
        : issueDateRelationship === "employee" || issueDateRelationship === "founder"
          ? "scheduled"
          : "invoice_paid",
    );
  }, [issueDateRelationship, form]);

  useEffect(() => {
    if (vestingTrigger !== "scheduled") {
      form.setValue("vesting_schedule_id", undefined);
    }
  }, [vestingTrigger, form]);

  useEffect(() => {
    if (vestingScheduleId !== "custom") {
      form.setValue("total_vesting_duration_months", null);
      form.setValue("cliff_duration_months", null);
      form.setValue("vesting_frequency_months", null);
    }
  }, [vestingScheduleId, form]);

  const createEquityGrant = trpc.equityGrants.create.useMutation({
    onSuccess: async () => {
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.equityGrants.byCountry.invalidate();
      await trpcUtils.capTable.show.invalidate();
      await trpcUtils.documents.list.invalidate();
      router.push(`/equity/grants`);
    },
    onError: (error) => {
      try {
        type FormFieldName = keyof FormValues | "root";
        
        const errorInfoSchema = z.object({
          error: z.string(),
          attribute_name: z
            .string()
            .nullable()
            .transform((value) => {
              if (!value) return null;
              const isFormField = (val: string): val is FormFieldName => 
                Object.keys(formSchema.shape).includes(val) || val === "root";
              return isFormField(value) ? value : "root";
            }),
        });

        const errorInfo = errorInfoSchema.parse(JSON.parse(error.message));
        if (errorInfo.attribute_name) {
          form.setError(errorInfo.attribute_name, {
            message: errorInfo.error,
          });
        } else {
          form.setError("root", {
            message: errorInfo.error,
          });
        }
      } catch (_e) {
        form.setError("root", {
          message: error.message || "An unexpected error occurred",
        });
      }
    },
  });

  const onSubmit = (values: FormValues) => {
    const isCustomVestingSchedule = values.vesting_trigger === "scheduled" && values.vesting_schedule_id === "custom";

    return createEquityGrant.mutateAsync({
      companyId: company.id,
      companyWorkerId: values.contractor,
      optionPoolId: values.option_pool,
      numberOfShares: values.number_of_shares,
      issueDateRelationship: values.issue_date_relationship,
      optionGrantType: values.option_grant_type,
      optionExpiryMonths: values.expires_at,
      voluntaryTerminationExerciseMonths: values.voluntary_termination_exercise_months,
      involuntaryTerminationExerciseMonths: values.involuntary_termination_exercise_months,
      terminationWithCauseExerciseMonths: values.termination_with_cause_exercise_months,
      deathExerciseMonths: values.death_exercise_months,
      disabilityExerciseMonths: values.disability_exercise_months,
      retirementExerciseMonths: values.retirement_exercise_months,
      vestingTrigger: values.vesting_trigger,
      vestingScheduleId: isCustomVestingSchedule ? null : values.vesting_schedule_id,
      vestingCommencementDate: values.vesting_trigger === "scheduled" ? values.vesting_commencement_date : null,
      totalVestingDurationMonths: isCustomVestingSchedule ? values.total_vesting_duration_months : null,
      cliffDurationMonths: isCustomVestingSchedule ? values.cliff_duration_months : null,
      vestingFrequencyMonths: isCustomVestingSchedule ? values.vesting_frequency_months : null,
    });
  };

  return (
    <MainLayout
      title="Create option grant"
      headerActions={
        <Button variant="outline" asChild>
          <Link href="/equity/grants">Cancel</Link>
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => {
          void onSubmit(values);
        })}>
          <FormSection title="Grant details">
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="contractor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={recipientOptions}
                        value={[field.value]}
                        onChange={(value) => field.onChange(value[0])}
                        placeholder="Select recipient"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="option_pool"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option pool</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={optionPoolOptions}
                        value={[field.value]}
                        onChange={(value) => field.onChange(value[0])}
                        placeholder="Select option pool"
                      />
                    </FormControl>
                    <FormMessage />
                    {optionPool ? (
                      <FormDescription>
                        Available shares in this option pool: {optionPool.availableShares.toLocaleString()}
                      </FormDescription>
                    ) : null}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number_of_shares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of options</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_date_relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to company</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={Object.entries(relationshipDisplayNames).map(([key, value]) => ({
                          label: value,
                          value: key,
                        }))}
                        value={field.value ? [field.value] : []}
                        onChange={(value) => field.onChange(value[0])}
                        placeholder="Select relationship"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="option_grant_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grant type</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={Object.entries(optionGrantTypeDisplayNames).map(([key, value]) => ({
                          label: value,
                          value: key,
                        }))}
                        value={[field.value]}
                        onChange={(value) => field.onChange(value[0])}
                        placeholder="Select grant type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <FormDescription>If not exercised, options will expire after this period.</FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </FormSection>

          <FormSection title="Vesting details">
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="vesting_trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shares will vest</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={Object.entries(vestingTriggerDisplayNames).map(([key, value]) => ({
                          label: value,
                          value: key,
                        }))}
                        value={field.value ? [field.value] : []}
                        onChange={(value) => field.onChange(value[0])}
                        placeholder="Select an option"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {vestingTrigger === "scheduled" && (
                <>
                  <FormField
                    control={form.control}
                    name="vesting_schedule_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vesting schedule</FormLabel>
                        <FormControl>
                          <ComboBox
                            options={vestingScheduleOptions}
                            value={field.value ? [field.value] : []}
                            onChange={(value) => field.onChange(value[0])}
                            placeholder="Select a vesting schedule"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vesting_commencement_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vesting commencement date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {vestingScheduleId === "custom" && (
                    <>
                      <FormField
                        control={form.control}
                        name="total_vesting_duration_months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total vesting duration</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={field.value || ""}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                                  }
                                />
                                <span className="ml-2 text-gray-600">months</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cliff_duration_months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliff period</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={field.value || ""}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                                  }
                                />
                                <span className="ml-2 text-gray-600">months</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="vesting_frequency_months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vesting frequency</FormLabel>
                            <FormControl>
                              <ComboBox
                                options={vestingFrequencyOptions}
                                value={field.value ? [field.value] : []}
                                onChange={(value) => field.onChange(value[0])}
                                placeholder="Select vesting frequency"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </>
              )}
            </CardContent>
          </FormSection>

          <FormSection title="Post-termination exercise periods">
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="voluntary_termination_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voluntary termination exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="involuntary_termination_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Involuntary termination exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="termination_with_cause_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Termination with cause exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="death_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Death exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="disability_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disability exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="retirement_exercise_months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retirement exercise period</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </FormSection>

          <div className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]">
            <div></div>
            <div className="grid gap-2">
              {form.formState.errors.root ? (
                <div className="text-red text-center text-xs">{form.formState.errors.root.message || "An error occurred"}</div>
              ) : null}
              <Button type="submit" disabled={createEquityGrant.isLoading}>
                {createEquityGrant.isLoading ? "Creating..." : "Create option grant"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </MainLayout>
  );
}
