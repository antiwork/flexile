"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { optionGrantTypeDisplayNames, relationshipDisplayNames, vestingTriggerDisplayNames } from "@/app/equity/grants";
import ComboBox from "@/components/ComboBox";
import MainLayout from "@/app/components/main-layout";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { optionGrantIssueDateRelationships, optionGrantTypes, optionGrantVestingTriggers } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";

const MAX_VESTING_DURATION_IN_MONTHS = 120;

const formSchema = z.object({
  companyWorkerId: z.string().min(1, "Must be present."),
  optionPoolId: z.string().min(1, "Must be present."),
  numberOfShares: z.number().gt(0),
  issueDateRelationship: z.enum(optionGrantIssueDateRelationships),
  optionGrantType: z.enum(optionGrantTypes),
  optionExpiryMonths: z.number().min(0),
  vestingTrigger: z.enum(optionGrantVestingTriggers),
  vestingScheduleId: z.string().nullish(),
  vestingCommencementDate: z.string().nullish(),
  totalVestingDurationMonths: z.number().nullish(),
  cliffDurationMonths: z.number().nullish(),
  vestingFrequencyMonths: z.string().nullish(),
  voluntaryTerminationExerciseMonths: z.number().min(0),
  involuntaryTerminationExerciseMonths: z.number().min(0),
  terminationWithCauseExerciseMonths: z.number().min(0),
  deathExerciseMonths: z.number().min(0),
  disabilityExerciseMonths: z.number().min(0),
  retirementExerciseMonths: z.number().min(0),
});
const refinedSchema = formSchema.refine(
  (data) => data.optionGrantType !== "iso" || ["employee", "founder"].includes(data.issueDateRelationship),
  {
    message: "ISOs can only be issued to employees or founders.",
    path: ["optionGrantType"],
  },
);

type FormValues = z.infer<typeof formSchema>;

export default function NewEquityGrant() {
  const today = assertDefined(new Date().toISOString().split("T")[0]);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.new.useSuspenseQuery({ companyId: company.id });

  const form = useForm({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
      companyWorkerId: "",
      optionPoolId: data.optionPools[0]?.id ?? "",
      numberOfShares: 10_000,
      optionGrantType: "nso",
      vestingCommencementDate: today,
      vestingTrigger: "invoice_paid",
    },
    context: {
      optionPools: data.optionPools,
    },
  });

  const recipientId = form.watch("companyWorkerId");
  const optionPoolId = form.watch("optionPoolId");
  const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
  const recipient = data.workers.find(({ id }) => id === recipientId);

  useEffect(() => {
    if (!recipientId) return;

    if (recipient?.salaried) {
      form.setValue("optionGrantType", "iso");
      form.setValue("issueDateRelationship", "employee");
    } else {
      const lastGrant = recipient?.lastGrant;
      form.setValue("optionGrantType", lastGrant?.optionGrantType ?? "nso");
      form.setValue("issueDateRelationship", lastGrant?.issueDateRelationship ?? "employee");
    }
  }, [recipientId]);

  useEffect(() => {
    if (!optionPool) return;

    form.setValue("optionExpiryMonths", optionPool.defaultOptionExpiryMonths);
    form.setValue("voluntaryTerminationExerciseMonths", optionPool.voluntaryTerminationExerciseMonths);
    form.setValue("involuntaryTerminationExerciseMonths", optionPool.involuntaryTerminationExerciseMonths);
    form.setValue("terminationWithCauseExerciseMonths", optionPool.terminationWithCauseExerciseMonths);
    form.setValue("deathExerciseMonths", optionPool.deathExerciseMonths);
    form.setValue("disabilityExerciseMonths", optionPool.disabilityExerciseMonths);
    form.setValue("retirementExerciseMonths", optionPool.retirementExerciseMonths);
  }, [optionPoolId]);

  const createEquityGrant = trpc.equityGrants.create.useMutation({
    onSuccess: async () => {
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.capTable.show.invalidate();
      await trpcUtils.documents.list.invalidate();
      router.push(`/equity/grants`);
    },
    onError: (error) => {
      const fieldNames = Object.keys(formSchema.shape);
      const errorInfoSchema = z.object({
        error: z.string(),
        attribute_name: z
          .string()
          .nullable()
          .transform((value) => {
            const isFormField = (val: string): val is keyof FormValues => fieldNames.includes(val);
            return value && isFormField(value) ? value : "root";
          }),
      });

      const errorInfo = errorInfoSchema.parse(JSON.parse(error.message));
      form.setError(errorInfo.attribute_name, { message: errorInfo.error });
    },
  });

  const submit = form.handleSubmit(async (values: FormValues): Promise<void> => {
    if (optionPool && optionPool.availableShares < values.numberOfShares)
      return form.setError("numberOfShares", {
        message: `Not enough shares available in the option pool "${optionPool.name}" to create a grant with this number of options.`,
      });

    if (values.vestingTrigger === "scheduled") {
      if (!values.vestingScheduleId) return form.setError("vestingScheduleId", { message: "Must be present." });
      if (!values.vestingCommencementDate)
        return form.setError("vestingCommencementDate", { message: "Must be present." });

      if (values.vestingScheduleId === "custom") {
        if (!values.totalVestingDurationMonths || values.totalVestingDurationMonths <= 0)
          return form.setError("totalVestingDurationMonths", { message: "Must be present and greater than 0." });
        if (values.totalVestingDurationMonths > MAX_VESTING_DURATION_IN_MONTHS)
          return form.setError("totalVestingDurationMonths", {
            message: `Must not be more than ${MAX_VESTING_DURATION_IN_MONTHS} months (${MAX_VESTING_DURATION_IN_MONTHS / 12} years).`,
          });
        if (values.cliffDurationMonths == null || values.cliffDurationMonths < 0)
          return form.setError("cliffDurationMonths", { message: "Must be present and greater than or equal to 0." });
        if (values.cliffDurationMonths >= values.totalVestingDurationMonths)
          return form.setError("cliffDurationMonths", { message: "Must be less than total vesting duration." });
        if (!values.vestingFrequencyMonths)
          return form.setError("vestingFrequencyMonths", { message: "Must be present." });
        if (Number(values.vestingFrequencyMonths) > values.totalVestingDurationMonths)
          return form.setError("vestingFrequencyMonths", { message: "Must be less than total vesting duration." });
      }
    }

    await createEquityGrant.mutateAsync({
      companyId: company.id,
      ...values,
      totalVestingDurationMonths: values.totalVestingDurationMonths ?? null,
      cliffDurationMonths: values.cliffDurationMonths ?? null,
      vestingFrequencyMonths: values.vestingFrequencyMonths ?? null,
      vestingCommencementDate: values.vestingCommencementDate ?? null,
      vestingScheduleId: values.vestingScheduleId ?? null,
    });
  });

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
        <form onSubmit={(e) => void submit(e)} className="grid gap-6">
          <div className="grid gap-4">
            <h2 className="text-2xl font-medium">Grant details</h2>
            <FormField
              control={form.control}
              name="companyWorkerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={data.workers
                        .sort((a, b) => a.user.name.localeCompare(b.user.name))
                        .map((worker) => ({ label: worker.user.name, value: worker.id }))}
                      placeholder="Select recipient"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="optionPoolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Option pool</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={data.optionPools.map((optionPool) => ({
                        label: optionPool.name,
                        value: optionPool.id,
                      }))}
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
              name="numberOfShares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of options</FormLabel>
                  <FormControl>
                    <NumberInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issueDateRelationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship to company</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={Object.entries(relationshipDisplayNames).map(([key, value]) => ({
                        label: value,
                        value: key,
                      }))}
                      placeholder="Select relationship"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="optionGrantType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grant type</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={Object.entries(optionGrantTypeDisplayNames).map(([key, value]) => ({
                        label: value,
                        value: key,
                      }))}
                      placeholder="Select grant type"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="optionExpiryMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>If not exercised, options will expire after this period.</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4">
            <h2 className="text-2xl font-medium">Vesting details</h2>
            <FormField
              control={form.control}
              name="vestingTrigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shares will vest</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={Object.entries(vestingTriggerDisplayNames).map(([key, value]) => ({
                        label: value,
                        value: key,
                      }))}
                      placeholder="Select an option"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("vestingTrigger") === "scheduled" && (
              <>
                <FormField
                  control={form.control}
                  name="vestingScheduleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vesting schedule</FormLabel>
                      <FormControl>
                        <ComboBox
                          {...field}
                          options={[
                            ...data.defaultVestingSchedules.map((schedule) => ({
                              label: schedule.name,
                              value: schedule.id,
                            })),
                            { label: "Custom", value: "custom" },
                          ]}
                          placeholder="Select a vesting schedule"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vestingCommencementDate"
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

                {form.watch("vestingScheduleId") === "custom" && (
                  <>
                    <FormField
                      control={form.control}
                      name="totalVestingDurationMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total vesting duration</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cliffDurationMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliff period</FormLabel>
                          <FormControl>
                            <NumberInput {...field} suffix="months" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vestingFrequencyMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vesting frequency</FormLabel>
                          <FormControl>
                            <ComboBox
                              {...field}
                              options={[
                                { label: "Monthly", value: "1" },
                                { label: "Quarterly", value: "3" },
                                { label: "Annually", value: "12" },
                              ]}
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
          </div>

          <div className="grid gap-4">
            <h2 className="text-2xl font-medium">Post-termination exercise periods</h2>
            <FormField
              control={form.control}
              name="voluntaryTerminationExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voluntary termination exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="involuntaryTerminationExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Involuntary termination exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terminationWithCauseExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Termination with cause exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deathExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Death exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="disabilityExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disability exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retirementExerciseMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retirement exercise period</FormLabel>
                  <FormControl>
                    <NumberInput {...field} suffix="months" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-2">
            {form.formState.errors.root ? (
              <div className="text-red text-center text-xs">
                {form.formState.errors.root.message ?? "An error occurred"}
              </div>
            ) : null}
            <MutationStatusButton type="submit" mutation={createEquityGrant} className="justify-self-end">
              Create option grant
            </MutationStatusButton>
          </div>
        </form>
      </Form>
    </MainLayout>
  );
}
