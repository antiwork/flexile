"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import TemplateSelector from "@/app/(dashboard)/document_templates/TemplateSelector";
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
import {
  DocumentTemplateType,
  optionGrantIssueDateRelationships,
  optionGrantTypes,
  optionGrantVestingTriggers,
} from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

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
  docusealTemplateId: z.string(),
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

  const createEquityGrant = trpc.equityGrants.create.useMutation({
    onSuccess: async () => {
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.capTable.show.invalidate();
      await trpcUtils.documents.list.invalidate();

      handleClose(false);
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
      vestingCommencementDate: values.vestingCommencementDate.toString(),
      vestingScheduleId: values.vestingScheduleId ?? null,
      boardApprovalDate: values.boardApprovalDate.toString(),
    });
  });

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setShowExercisePeriods(false);
      form.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">New equity grant</DialogTitle>
          <DialogDescription>Fill in the details below to create an equity grant.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid gap-6">
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

            <FormField
              control={form.control}
              name="docusealTemplateId"
              render={({ field }) => <TemplateSelector type={DocumentTemplateType.EquityPlanContract} {...field} />}
            />

            <div className="grid gap-2">
              {form.formState.errors.root ? (
                <div className="text-red text-center text-xs">
                  {form.formState.errors.root.message ?? "An error occurred"}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <MutationStatusButton
                type="submit"
                mutation={createEquityGrant}
                disabled={!isFormValid || createEquityGrant.isPending}
              >
                Create grant
              </MutationStatusButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
