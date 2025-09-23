"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation } from "@tanstack/react-query";
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
import {
  DialogStack,
  DialogStackBody,
  DialogStackContent,
  DialogStackDescription,
  DialogStackFooter,
  DialogStackHeader,
  DialogStackPrevious,
  DialogStackTitle,
} from "@/components/ui/dialog-stack";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { optionGrantIssueDateRelationships, optionGrantTypes, optionGrantVestingTriggers } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_administrator_equity_grants_path } from "@/utils/routes";

const MAX_VESTING_DURATION_IN_MONTHS = 120;

const detailsFormSchema = z
  .object({
    userId: z.string().min(1, "Must be present."),
    optionPoolId: z.string().min(1, "Must be present."),
    numberOfShares: z.number().gt(0),
    issueDateRelationship: z.enum(optionGrantIssueDateRelationships),
    optionGrantType: z.enum(optionGrantTypes),
    optionExpiryMonths: z.number().min(0),
    voluntaryTerminationExerciseMonths: z.number().min(0),
    involuntaryTerminationExerciseMonths: z.number().min(0),
    terminationWithCauseExerciseMonths: z.number().min(0),
    deathExerciseMonths: z.number().min(0),
    disabilityExerciseMonths: z.number().min(0),
    retirementExerciseMonths: z.number().min(0),
    boardApprovalDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  })
  .refine((data) => data.optionGrantType !== "iso" || ["employee", "founder"].includes(data.issueDateRelationship), {
    message: "ISOs can only be issued to employees or founders.",
    path: ["optionGrantType"],
  });
const vestingFormSchema = z.object({
  vestingTrigger: z.enum(optionGrantVestingTriggers),
  vestingScheduleId: z.string().nullish(),
  vestingCommencementDate: z.instanceof(CalendarDate, { message: "This field is required." }),
  totalVestingDurationMonths: z.number().nullish(),
  cliffDurationMonths: z.number().nullish(),
  vestingFrequencyMonths: z.string().nullish(),
});

const documentFormSchema = documentSchema.refine((data) => !!data.contract, {
  message: "Equity contract is required",
  path: ["contract"],
});

interface NewEquityGrantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewEquityGrantModal({ open, onOpenChange }: NewEquityGrantModalProps) {
  const trpcUtils = trpc.useUtils();
  const company = useCurrentCompany();
  const [step, setStep] = useState(0);
  const [data] = trpc.equityGrants.new.useSuspenseQuery({ companyId: company.id });
  const [showExercisePeriods, setShowExercisePeriods] = useState(false);

  const detailsForm = useForm({
    resolver: zodResolver(detailsFormSchema),
    defaultValues: {
      userId: "",
      optionPoolId: data.optionPools[0]?.id ?? "",
      numberOfShares: 10_000,
      optionGrantType: "nso" as const,
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
  const vestingForm = useForm({
    resolver: zodResolver(vestingFormSchema),
    values: {
      vestingTrigger: "invoice_paid" as const,
      vestingCommencementDate: today(getLocalTimeZone()),
    },
  });
  const documentForm = useForm({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      contract: "",
    },
  });

  const recipientId = detailsForm.watch("userId");
  const optionPoolId = detailsForm.watch("optionPoolId");
  const numberOfShares = detailsForm.watch("numberOfShares");
  const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
  const recipient = data.users.find(({ id }) => id === recipientId);

  const estimatedValue =
    data.sharePriceUsd && numberOfShares && !isNaN(Number(data.sharePriceUsd))
      ? formatMoney(Number(data.sharePriceUsd) * numberOfShares)
      : null;

  useEffect(() => {
    if (!recipientId) return;

    const lastGrant = recipient?.lastGrant;
    detailsForm.setValue("optionGrantType", lastGrant?.optionGrantType ?? "nso");
    detailsForm.setValue("issueDateRelationship", lastGrant?.issueDateRelationship ?? "employee");
    void detailsForm.trigger("issueDateRelationship");
    if (!recipient?.activeContractor) vestingForm.setValue("vestingTrigger", "scheduled");
  }, [recipientId]);

  useEffect(() => {
    if (!optionPool) return;

    detailsForm.setValue("optionExpiryMonths", optionPool.defaultOptionExpiryMonths);
    detailsForm.setValue("voluntaryTerminationExerciseMonths", optionPool.voluntaryTerminationExerciseMonths);
    detailsForm.setValue("involuntaryTerminationExerciseMonths", optionPool.involuntaryTerminationExerciseMonths);
    detailsForm.setValue("terminationWithCauseExerciseMonths", optionPool.terminationWithCauseExerciseMonths);
    detailsForm.setValue("deathExerciseMonths", optionPool.deathExerciseMonths);
    detailsForm.setValue("disabilityExerciseMonths", optionPool.disabilityExerciseMonths);
    detailsForm.setValue("retirementExerciseMonths", optionPool.retirementExerciseMonths);
  }, [optionPool]);

  const createEquityGrant = useMutation({
    mutationFn: async (values: z.infer<typeof documentFormSchema>) => {
      const detailsValues = detailsForm.getValues();
      const vestingValues = vestingForm.getValues();
      const formData = new FormData();

      formData.append("equity_grant[user_id]", detailsValues.userId);

      formData.append("equity_grant[option_pool_id]", detailsValues.optionPoolId);
      formData.append("equity_grant[number_of_shares]", detailsValues.numberOfShares.toString());
      formData.append("equity_grant[issue_date_relationship]", detailsValues.issueDateRelationship);
      formData.append("equity_grant[option_grant_type]", detailsValues.optionGrantType);
      formData.append("equity_grant[option_expiry_months]", detailsValues.optionExpiryMonths.toString());
      formData.append(
        "equity_grant[voluntary_termination_exercise_months]",
        detailsValues.voluntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "equity_grant[involuntary_termination_exercise_months]",
        detailsValues.involuntaryTerminationExerciseMonths.toString(),
      );
      formData.append(
        "equity_grant[termination_with_cause_exercise_months]",
        detailsValues.terminationWithCauseExerciseMonths.toString(),
      );
      formData.append("equity_grant[death_exercise_months]", detailsValues.deathExerciseMonths.toString());
      formData.append("equity_grant[disability_exercise_months]", detailsValues.disabilityExerciseMonths.toString());
      formData.append("equity_grant[retirement_exercise_months]", detailsValues.retirementExerciseMonths.toString());
      formData.append("equity_grant[board_approval_date]", detailsValues.boardApprovalDate.toString());
      formData.append("equity_grant[vesting_trigger]", vestingValues.vestingTrigger);
      formData.append("equity_grant[vesting_commencement_date]", vestingValues.vestingCommencementDate.toString());
      formData.append("equity_grant[contract]", values.contract);

      if (vestingValues.vestingTrigger === "scheduled" && vestingValues.vestingScheduleId) {
        formData.append("equity_grant[vesting_schedule_id]", vestingValues.vestingScheduleId);

        if (
          vestingValues.vestingScheduleId === "custom" &&
          vestingValues.totalVestingDurationMonths &&
          vestingValues.cliffDurationMonths &&
          vestingValues.vestingFrequencyMonths
        ) {
          formData.append(
            "equity_grant[total_vesting_duration_months]",
            vestingValues.totalVestingDurationMonths.toString(),
          );
          formData.append("equity_grant[cliff_duration_months]", vestingValues.cliffDurationMonths.toString());
          formData.append("equity_grant[vesting_frequency_months]", vestingValues.vestingFrequencyMonths);
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
        });

        const errorInfo = errorInfoSchema.parse(JSON.parse(await response.text()));
        documentForm.setError("root", { message: errorInfo.error });
        throw new Error(await response.text());
      }
      await trpcUtils.equityGrants.list.invalidate();
      await trpcUtils.equityGrants.totals.invalidate();
      await trpcUtils.capTable.show.invalidate();

      handleClose();
    },
  });

  const submitDetails = detailsForm.handleSubmit((values: z.infer<typeof detailsFormSchema>) => {
    if (optionPool && optionPool.availableShares < values.numberOfShares)
      return detailsForm.setError("numberOfShares", {
        message: `Not enough shares available in the option pool "${optionPool.name}" to create a grant with this number of options.`,
      });
    setStep(1);
  });
  const submitVesting = vestingForm.handleSubmit((values: z.infer<typeof vestingFormSchema>) => {
    if (values.vestingTrigger === "scheduled") {
      if (!values.vestingScheduleId) return vestingForm.setError("vestingScheduleId", { message: "Must be present." });
      if (values.vestingScheduleId === "custom") {
        if (!values.totalVestingDurationMonths || values.totalVestingDurationMonths <= 0)
          return vestingForm.setError("totalVestingDurationMonths", { message: "Must be present and greater than 0." });
        if (values.totalVestingDurationMonths > MAX_VESTING_DURATION_IN_MONTHS)
          return vestingForm.setError("totalVestingDurationMonths", {
            message: `Must not be more than ${MAX_VESTING_DURATION_IN_MONTHS} months (${MAX_VESTING_DURATION_IN_MONTHS / 12} years).`,
          });
        if (values.cliffDurationMonths == null || values.cliffDurationMonths < 0)
          return vestingForm.setError("cliffDurationMonths", {
            message: "Must be present and greater than or equal to 0.",
          });
        if (values.cliffDurationMonths >= values.totalVestingDurationMonths)
          return vestingForm.setError("cliffDurationMonths", { message: "Must be less than total vesting duration." });
        if (!values.vestingFrequencyMonths)
          return vestingForm.setError("vestingFrequencyMonths", { message: "Must be present." });
        if (Number(values.vestingFrequencyMonths) > values.totalVestingDurationMonths)
          return vestingForm.setError("vestingFrequencyMonths", {
            message: "Must be less than total vesting duration.",
          });
      }
    }
    setStep(2);
  });
  const submit = documentForm.handleSubmit((values) => createEquityGrant.mutate(values));

  const handleClose = () => {
    setShowExercisePeriods(false);
    detailsForm.reset();
    vestingForm.reset();
    documentForm.reset();
    setStep(0);
    onOpenChange(false);
  };

  return (
    <DialogStack
      open={open}
      onOpenChange={(open) => (open ? undefined : handleClose())}
      activeIndex={step}
      setActiveIndex={setStep}
    >
      <DialogStackBody>
        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>New equity grant</DialogStackTitle>
            <DialogStackDescription>Fill in the details below to create an equity grant.</DialogStackDescription>
          </DialogStackHeader>
          <Form {...detailsForm}>
            <form onSubmit={(e) => void submitDetails(e)} className="contents">
              <div className="grid h-auto gap-4 overflow-y-auto">
                <FormField
                  control={detailsForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient</FormLabel>
                      <FormControl>
                        <ComboBox
                          {...field}
                          options={data.users
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((user) => ({
                              label: `${user.name} (${user.email})`,
                              value: user.id,
                              keywords: [user.name, user.email],
                            }))}
                          placeholder="Select recipient"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={detailsForm.control}
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
                  control={detailsForm.control}
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
                  control={detailsForm.control}
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
                          Estimated value of {estimatedValue}, based on a {formatMoney(Number(data.sharePriceUsd))}{" "}
                          share price
                        </FormDescription>
                      ) : null}
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={detailsForm.control}
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
                    control={detailsForm.control}
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
                <div className="grid gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex h-auto w-full items-start justify-between p-0 text-left whitespace-break-spaces hover:bg-transparent"
                    onClick={() => setShowExercisePeriods(!showExercisePeriods)}
                  >
                    <h2 className="text-base">Customize post-termination exercise periods</h2>
                    {showExercisePeriods ? (
                      <ChevronDown className="mt-[3px] size-5" />
                    ) : (
                      <ChevronRight className="mt-[3px] size-5" />
                    )}
                  </Button>

                  {showExercisePeriods ? (
                    <div className="grid gap-4">
                      <FormField
                        control={detailsForm.control}
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
                        control={detailsForm.control}
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
                        control={detailsForm.control}
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
                        control={detailsForm.control}
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
                        control={detailsForm.control}
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
                        control={detailsForm.control}
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
                  control={detailsForm.control}
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

              {step === 0 && (
                <DialogStackFooter>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!detailsForm.formState.isValid}>
                    Continue
                  </Button>
                </DialogStackFooter>
              )}
            </form>
          </Form>
        </DialogStackContent>
        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>Vesting details</DialogStackTitle>
          </DialogStackHeader>
          <Form {...vestingForm}>
            <form onSubmit={(e) => void submitVesting(e)} className="contents">
              {recipient?.activeContractor ? (
                <FormField
                  control={vestingForm.control}
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
              ) : null}

              {vestingForm.watch("vestingTrigger") === "scheduled" && (
                <>
                  <FormField
                    control={vestingForm.control}
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
                    control={vestingForm.control}
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

                  {vestingForm.watch("vestingScheduleId") === "custom" && (
                    <>
                      <FormField
                        control={vestingForm.control}
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
                        control={vestingForm.control}
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
                        control={vestingForm.control}
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
              {step === 1 && (
                <DialogStackFooter>
                  <DialogStackPrevious>
                    <Button variant="outline">Back</Button>
                  </DialogStackPrevious>
                  <Button type="submit" disabled={!vestingForm.formState.isValid}>
                    Continue
                  </Button>
                </DialogStackFooter>
              )}
            </form>
          </Form>
        </DialogStackContent>
        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>Equity contract</DialogStackTitle>
          </DialogStackHeader>
          <Form {...documentForm}>
            <form onSubmit={(e) => void submit(e)} className="contents">
              <NewDocumentField type="stock_option_agreement" />

              {documentForm.formState.errors.root ? (
                <div className="grid gap-2">
                  <div className="text-red text-center text-xs">
                    {documentForm.formState.errors.root.message ?? "An error occurred"}
                  </div>
                </div>
              ) : null}
              <DialogStackFooter>
                <DialogStackPrevious>
                  <Button variant="outline">Back</Button>
                </DialogStackPrevious>
                <MutationStatusButton
                  type="submit"
                  mutation={createEquityGrant}
                  disabled={!documentForm.formState.isValid}
                >
                  Create grant
                </MutationStatusButton>
              </DialogStackFooter>
            </form>
          </Form>
        </DialogStackContent>
      </DialogStackBody>
    </DialogStack>
  );
}
