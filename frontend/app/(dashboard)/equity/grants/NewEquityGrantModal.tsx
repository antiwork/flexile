"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
import { camelCase } from "lodash-es";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import NewDocumentField, { schema as documentSchema } from "@/app/(dashboard)/documents/NewDocumentField";
import {
  optionGrantTypeDisplayNames,
  relationshipDisplayNames,
  vestingTriggerDisplayNames,
} from "@/app/(dashboard)/equity/grants";
import ComboBox from "@/components/ComboBox";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { optionGrantIssueDateRelationships, optionGrantTypes, optionGrantVestingTriggers } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_administrator_equity_grants_path } from "@/utils/routes";

const MAX_VESTING_DURATION_IN_MONTHS = 120;

const formSchema = documentSchema.extend({
  companyWorkerId: z.string().min(1, "Must be present."),
  optionPoolId: z.string().min(1, "Must be present."),
  numberOfShares: z.number().gt(0),
  issueDateRelationship: z.enum(optionGrantIssueDateRelationships),
  optionGrantType: z.enum(optionGrantTypes),
  optionExpiryMonths: z.number().min(0),
  vestingTrigger: z.enum(optionGrantVestingTriggers),
  vestingScheduleId: z.string().nullish(),
  vestingCommencementDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  totalVestingDurationMonths: z.number().nullish(),
  cliffDurationMonths: z.number().nullish(),
  vestingFrequencyMonths: z.string().nullish(),
  voluntaryTerminationExerciseMonths: z.number().min(0),
  involuntaryTerminationExerciseMonths: z.number().min(0),
  terminationWithCauseExerciseMonths: z.number().min(0),
  deathExerciseMonths: z.number().min(0),
  disabilityExerciseMonths: z.number().min(0),
  retirementExerciseMonths: z.number().min(0),
  boardApprovalDate: z.instanceof(CalendarDate, { message: "This field is required." }),
});

const refinedSchema = formSchema.refine(
  (data) => data.optionGrantType !== "iso" || ["employee", "founder"].includes(data.issueDateRelationship),
  {
    message: "ISOs can only be issued to employees or founders.",
    path: ["optionGrantType"],
  },
);

type FormValues = z.infer<typeof formSchema>;

interface NewEquityGrantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewEquityGrantModal({ open, onOpenChange }: NewEquityGrantModalProps) {
  const trpcUtils = trpc.useUtils();
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.new.useSuspenseQuery({ companyId: company.id });
  const [showExercisePeriods, setShowExercisePeriods] = useState(false);

  const form = useForm({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
      companyWorkerId: "",
      optionPoolId: data.optionPools[0]?.id ?? "",
      numberOfShares: 10_000,
      optionGrantType: "nso" as const,
      vestingCommencementDate: today(getLocalTimeZone()),
      vestingTrigger: "invoice_paid" as const,
      boardApprovalDate: today(getLocalTimeZone()),
      optionExpiryMonths: data.optionPools[0]?.defaultOptionExpiryMonths ?? 120,
      voluntaryTerminationExerciseMonths: data.optionPools[0]?.voluntaryTerminationExerciseMonths ?? 3,
      involuntaryTerminationExerciseMonths: data.optionPools[0]?.involuntaryTerminationExerciseMonths ?? 3,
      terminationWithCauseExerciseMonths: data.optionPools[0]?.terminationWithCauseExerciseMonths ?? 3,
      deathExerciseMonths: data.optionPools[0]?.deathExerciseMonths ?? 12,
      disabilityExerciseMonths: data.optionPools[0]?.disabilityExerciseMonths ?? 12,
      retirementExerciseMonths: data.optionPools[0]?.retirementExerciseMonths ?? 12,
    },
    context: {
      optionPools: data.optionPools,
    },
  });

  const recipientId = form.watch("companyWorkerId");
  const optionPoolId = form.watch("optionPoolId");
  const numberOfShares = form.watch("numberOfShares");
  const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
  const recipient = data.workers.find(({ id }) => id === recipientId);

  const estimatedValue =
    data.sharePriceUsd && numberOfShares && !isNaN(Number(data.sharePriceUsd))
      ? (Number(data.sharePriceUsd) * numberOfShares).toFixed(2)
      : null;

  const isFormValid = form.formState.isValid;

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
  }, [optionPool]);

  const createEquityGrant = useMutation({
    mutationFn: async (values: FormValues) => {
      if (optionPool && optionPool.availableShares < values.numberOfShares)
        return form.setError("numberOfShares", {
          message: `Not enough shares available in the option pool "${optionPool.name}" to create a grant with this number of options.`,
        });

      const formData = new FormData();
      formData.append("equity_grant[company_worker_id]", values.companyWorkerId);
      formData.append("equity_grant[option_pool_id]", values.optionPoolId);
      formData.append("equity_grant[number_of_shares]", values.numberOfShares.toString());
      formData.append("equity_grant[issue_date_relationship]", values.issueDateRelationship);
      formData.append("equity_grant[option_grant_type]", values.optionGrantType);
      formData.append("equity_grant[option_expiry_months]", values.optionExpiryMonths.toString());
      formData.append(
        "equity_grant[voluntary_termination_exercise_months]",
        values.voluntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "equity_grant[involuntary_termination_exercise_months]",
        values.involuntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "equity_grant[termination_with_cause_exercise_months]",
        values.terminationWithCauseExerciseMonths.toString(),
      );
      formData.append("equity_grant[death_exercise_months]", values.deathExerciseMonths.toString());
      formData.append("equity_grant[disability_exercise_months]", values.disabilityExerciseMonths.toString());
      formData.append("equity_grant[retirement_exercise_months]", values.retirementExerciseMonths.toString());
      formData.append("equity_grant[board_approval_date]", values.boardApprovalDate.toString());
      formData.append("equity_grant[vesting_trigger]", values.vestingTrigger);
      formData.append("equity_grant[vesting_commencement_date]", values.vestingCommencementDate.toString());
      formData.append("equity_grant[contract]", values.contract);

      if (values.vestingTrigger === "scheduled") {
        if (!values.vestingScheduleId) return form.setError("vestingScheduleId", { message: "Must be present." });
        formData.append("equity_grant[vesting_schedule_id]", values.vestingScheduleId);

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

          formData.append("equity_grant[total_vesting_duration_months]", values.totalVestingDurationMonths.toString());
          formData.append("equity_grant[cliff_duration_months]", values.cliffDurationMonths.toString());
          formData.append("equity_grant[vesting_frequency_months]", values.vestingFrequencyMonths);
        }
      }

      const response = await request({
        url: company_administrator_equity_grants_path(company.id),
        method: "POST",
        formData,
        accept: "json",
      });
      if (!response.ok) {
        const errorInfoSchema = z.object({
          error: z.string(),
          attribute_name: z
            .string()
            .nullable()
            .transform((value) => {
              value = camelCase(value ?? "");
              const isFormField = (val: string): val is keyof FormValues => val in formSchema.shape;
              return value && isFormField(value) ? value : "root";
            }),
        });

        const errorInfo = errorInfoSchema.parse(JSON.parse(await response.text()));
        form.setError(errorInfo.attribute_name, { message: errorInfo.error });
        throw new Error(await response.text());
      }
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.capTable.show.invalidate();
      await trpcUtils.documents.list.invalidate();

      handleClose();
    },
  });

  const submit = form.handleSubmit((values: FormValues) => createEquityGrant.mutate(values));

  const handleClose = () => {
    setShowExercisePeriods(false);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">New equity grant</DialogTitle>
          <DialogDescription>Fill in the details below to create an equity grant.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid gap-8">
            <div className="grid gap-4">
              <h2 className="text-lg font-medium">Recipient details</h2>
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
            </div>

            <div className="grid gap-4">
              <h2 className="text-lg font-medium">Option grant details</h2>
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
                    {estimatedValue ? (
                      <FormDescription>
                        Estimated value: ${estimatedValue}, based on a ${data.sharePriceUsd}
                      </FormDescription>
                    ) : null}
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                      <FormLabel>Expiration period</FormLabel>
                      <FormControl>
                        <NumberInput {...field} suffix="months" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="boardApprovalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DatePicker {...field} label="Board approval date" granularity="day" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4">
              <h2 className="text-lg font-medium">Vesting details</h2>
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
                        <FormControl>
                          <DatePicker {...field} label="Vesting commencement date" granularity="day" />
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
              <Button
                type="button"
                variant="ghost"
                className="flex h-auto w-full items-center justify-between p-0 text-left hover:bg-transparent"
                onClick={() => setShowExercisePeriods(!showExercisePeriods)}
              >
                <h2 className="text-lg font-medium">Customize post-termination exercise period</h2>
                {showExercisePeriods ? <ChevronDown className="size-6" /> : <ChevronRight className="size-6" />}
              </Button>

              {showExercisePeriods ? (
                <div className="grid gap-4">
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
              ) : null}
            </div>

            <NewDocumentField />

            {form.formState.errors.root ? (
              <div className="grid gap-2">
                <div className="text-red text-center text-xs">
                  {form.formState.errors.root.message ?? "An error occurred"}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <MutationStatusButton type="submit" mutation={createEquityGrant} disabled={!isFormValid}>
                Create grant
              </MutationStatusButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
