"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronDown, X } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  vestingFrequencyMonths: z.number().nullish(),
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
  const [isPostTerminationExpanded, setIsPostTerminationExpanded] = useState(false);

  const { data, isLoading } = trpc.equityGrants.new.useQuery({ companyId: company.id }, { enabled: open });

  const form = useForm({
    resolver: zodResolver(refinedSchema),
    defaultValues: {
      companyWorkerId: "",
      optionPoolId: "",
      numberOfShares: 10_000,
      optionGrantType: "nso" as const,
      vestingCommencementDate: today(getLocalTimeZone()),
      vestingTrigger: "invoice_paid" as const,
      boardApprovalDate: today(getLocalTimeZone()),
      voluntaryTerminationExerciseMonths: 120,
      involuntaryTerminationExerciseMonths: 120,
      terminationWithCauseExerciseMonths: 0,
      deathExerciseMonths: 120,
      disabilityExerciseMonths: 120,
      retirementExerciseMonths: 120,
    },
  });

  useEffect(() => {
    if (open && data) {
      form.reset({
        companyWorkerId: "",
        optionPoolId: data.optionPools[0]?.id ?? "",
        numberOfShares: 10_000,
        optionGrantType: "nso" as const,
        vestingCommencementDate: today(getLocalTimeZone()),
        vestingTrigger: "invoice_paid" as const,
        boardApprovalDate: today(getLocalTimeZone()),
        voluntaryTerminationExerciseMonths: 120,
        involuntaryTerminationExerciseMonths: 120,
        terminationWithCauseExerciseMonths: 0,
        deathExerciseMonths: 120,
        disabilityExerciseMonths: 120,
        retirementExerciseMonths: 120,
      });
    }
  }, [open, data]);

  const recipientId = form.watch("companyWorkerId");
  const optionPoolId = form.watch("optionPoolId");
  const optionPool = data?.optionPools.find((pool) => pool.id === optionPoolId);

  useEffect(() => {
    if (!recipientId || !data) return;

    const recipient = data.workers.find(({ id }) => id === recipientId);
    if (recipient?.salaried) {
      form.setValue("optionGrantType", "iso");
      form.setValue("issueDateRelationship", "employee");
    } else {
      const lastGrant = recipient?.lastGrant;
      form.setValue("optionGrantType", lastGrant?.optionGrantType ?? "nso");
      form.setValue("issueDateRelationship", lastGrant?.issueDateRelationship ?? "employee");
    }
  }, [recipientId, data]);

  useEffect(() => {
    if (!optionPoolId || !data) return;

    const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
    if (!optionPool) return;

    form.setValue("optionExpiryMonths", optionPool.defaultOptionExpiryMonths);
    form.setValue("voluntaryTerminationExerciseMonths", optionPool.voluntaryTerminationExerciseMonths);
    form.setValue("involuntaryTerminationExerciseMonths", optionPool.involuntaryTerminationExerciseMonths);
    form.setValue("terminationWithCauseExerciseMonths", optionPool.terminationWithCauseExerciseMonths);
    form.setValue("deathExerciseMonths", optionPool.deathExerciseMonths);
    form.setValue("disabilityExerciseMonths", optionPool.disabilityExerciseMonths);
    form.setValue("retirementExerciseMonths", optionPool.retirementExerciseMonths);
  }, [optionPoolId, data]);

  const createEquityGrant = trpc.equityGrants.create.useMutation({
    onSuccess: async () => {
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.capTable.show.invalidate();
      await trpcUtils.documents.list.invalidate();
      onOpenChange(false);
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
        if (values.vestingFrequencyMonths > values.totalVestingDurationMonths)
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

  if (!data && isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-xl leading-7 font-semibold tracking-normal">New equity grant</DialogTitle>
            <p className="text-muted-foreground mt-1 text-base leading-relaxed tracking-tight">
              Fill in the details below to create an equity grant.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {data ? (
          <Form {...form}>
            <form onSubmit={(e) => void submit(e)} className="space-y-6">
              {/* Recipient details */}
              <div className="space-y-4">
                <h3 className="text-base leading-5 font-medium tracking-normal">Recipient details</h3>

                <FormField
                  control={form.control}
                  name="companyWorkerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm leading-5 font-light tracking-normal">Recipient</FormLabel>
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
                      <FormLabel className="text-sm leading-5 font-light tracking-normal">
                        Relationship to company
                      </FormLabel>
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

              {/* Option grant details */}
              <div className="space-y-4">
                <h3 className="text-base leading-5 font-medium tracking-normal">Option grant details</h3>

                <FormField
                  control={form.control}
                  name="optionPoolId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm leading-5 font-light tracking-normal">Option pool</FormLabel>
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
                      <FormLabel className="text-sm leading-5 font-light tracking-normal">Number of options</FormLabel>
                      <FormControl>
                        <NumberInput {...field} />
                      </FormControl>
                      <FormMessage />
                      {company.sharePriceInUsd && form.watch("numberOfShares") ? (
                        <FormDescription>
                          Estimated value: $
                          {(form.watch("numberOfShares") * parseFloat(company.sharePriceInUsd)).toLocaleString()}, based
                          on a ${parseFloat(company.sharePriceInUsd).toFixed(2)} share price.
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">Grant type</FormLabel>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Expiration period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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

              {/* Vesting details */}
              <div className="space-y-4">
                <h3 className="text-base leading-5 font-medium tracking-normal">Vesting details</h3>

                <FormField
                  control={form.control}
                  name="vestingTrigger"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm leading-5 font-light tracking-normal">Shares will vest</FormLabel>
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
                          <FormLabel className="text-sm leading-5 font-light tracking-normal">
                            Vesting schedule
                          </FormLabel>
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
                              <FormLabel className="text-sm leading-5 font-light tracking-normal">
                                Total vesting duration
                              </FormLabel>
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
                              <FormLabel className="text-sm leading-5 font-light tracking-normal">
                                Cliff period
                              </FormLabel>
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
                              <FormLabel className="text-sm leading-5 font-light tracking-normal">
                                Vesting frequency
                              </FormLabel>
                              <FormControl>
                                <ComboBox
                                  {...field}
                                  options={[
                                    { label: "Monthly", value: 1 },
                                    { label: "Quarterly", value: 3 },
                                    { label: "Annually", value: 12 },
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

              {/* Customize post-termination exercise periods (Collapsible) */}
              <Collapsible open={isPostTerminationExpanded} onOpenChange={setIsPostTerminationExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="h-auto w-full justify-between p-0">
                    <h3 className="text-left text-base leading-5 font-medium tracking-normal">
                      Customize post-termination exercise periods
                    </h3>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isPostTerminationExpanded ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="voluntaryTerminationExerciseMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Voluntary termination exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Involuntary termination exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Termination with cause exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Death exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Disability exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
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
                        <FormLabel className="text-sm leading-5 font-light tracking-normal">
                          Retirement exercise period
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumberInput {...field} />
                            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-gray-500">
                              months
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
              <FormField
                control={form.control}
                name="docusealTemplateId"
                render={({ field }) => <TemplateSelector type={DocumentTemplateType.EquityPlanContract} {...field} />}
              />
              {form.formState.errors.root ? (
                <div className="mt-2 text-center text-sm text-red-600">
                  {form.formState.errors.root.message ?? "An error occurred"}
                </div>
              ) : null}
              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                  Cancel
                </Button>
                <MutationStatusButton type="submit" mutation={createEquityGrant}>
                  Create grant
                </MutationStatusButton>
              </div>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
