"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { optionGrantTypeDisplayNames, relationshipDisplayNames, vestingTriggerDisplayNames } from "@/app/equity/grants";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";

const MAX_VESTING_DURATION_IN_MONTHS = 120;

const fieldAttributeName = z.enum([
  "contractor",
  "option_pool",
  "number_of_shares",
  "issue_date_relationship",
  "option_grant_type",
  "expires_at",
  "vesting_commencement_date",
  "vesting_trigger",
  "vesting_schedule_id",
  "total_vesting_duration_months",
  "cliff_duration_months",
  "vesting_frequency_months",
  "voluntary_termination_exercise_months",
  "involuntary_termination_exercise_months",
  "termination_with_cause_exercise_months",
  "death_exercise_months",
  "disability_exercise_months",
  "retirement_exercise_months",
]);
type FieldAttributeName = z.infer<typeof fieldAttributeName>;

type ErrorInfo = { error: string; attribute_name: FieldAttributeName | null };

const invalidFieldAttrs = (name: FieldAttributeName, errorInfo: ErrorInfo | null, defaultHelp?: string) => {
  const invalid = errorInfo?.attribute_name === name;
  const help = invalid ? errorInfo.error : defaultHelp;

  return { invalid, help };
};

type IssueDateRelationship = keyof typeof relationshipDisplayNames;
type OptionGrantType = keyof typeof optionGrantTypeDisplayNames;
type VestingTrigger = keyof typeof vestingTriggerDisplayNames;

const vestingFrequencyOptions = [
  { label: "Monthly", value: "1" },
  { label: "Quarterly", value: "3" },
  { label: "Annually", value: "12" },
];

const isLiteralValue = <T extends string>(value: string, literalValues: Record<T, unknown>): value is T =>
  value in literalValues;

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

  const [recipientId, setRecipientId] = useState<string | undefined>();
  const [optionPoolId, setOptionPoolId] = useState(data.optionPools.length === 1 ? data.optionPools[0]?.id : undefined);
  const optionPool = data.optionPools.find((pool) => pool.id === optionPoolId);
  const [numberOfShares, setNumberOfShares] = useState<number | null>(null);
  const [issueDateRelationship, setIssueDateRelationship] = useState<IssueDateRelationship | undefined>();
  const [grantType, setGrantType] = useState<OptionGrantType>("nso");
  const [expiryInMonths, setExpiryInMonths] = useState<number | null>(null);
  const [vestingTrigger, setVestingTrigger] = useState<VestingTrigger | undefined>();
  const [vestingScheduleId, setVestingScheduleId] = useState<string | undefined>();
  const [vestingCommencementDate, setVestingCommencementDate] = useState(today);
  const [totalVestingDurationMonths, setTotalVestingDurationMonths] = useState<number | null>(null);
  const [cliffDurationMonths, setCliffDurationMonths] = useState<number | null>(null);
  const [vestingFrequencyMonths, setVestingFrequencyMonths] = useState<string | null>(null);
  const [voluntaryTerminationExercisePeriodInMonths, setVoluntaryTerminationExercisePeriodInMonths] = useState<
    number | null
  >(null);
  const [involuntaryTerminationExercisePeriodInMonths, setInvoluntaryTerminationExercisePeriodInMonths] = useState<
    number | null
  >(null);
  const [terminationWithCauseExercisePeriodInMonths, setTerminationWithCauseExercisePeriodInMonths] = useState<
    number | null
  >(null);
  const [deathExercisePeriodInMonths, setDeathExercisePeriodInMonths] = useState<number | null>(null);
  const [disabilityExercisePeriodInMonths, setDisabilityExercisePeriodInMonths] = useState<number | null>(null);
  const [retirementExercisePeriodInMonths, setRetirementExercisePeriodInMonths] = useState<number | null>(null);

  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  const recipientRef = useRef<HTMLSelectElement>(null);
  const optionPoolRef = useRef<HTMLSelectElement>(null);
  const numberOfSharesRef = useRef<HTMLInputElement>(null);
  const relationshipRef = useRef<HTMLSelectElement>(null);
  const grantTypeRef = useRef<HTMLSelectElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const vestingTriggerRef = useRef<HTMLSelectElement>(null);
  const vestingScheduleRef = useRef<HTMLSelectElement>(null);
  const vestingCommencementRef = useRef<HTMLInputElement>(null);
  const totalVestingDurationRef = useRef<HTMLInputElement>(null);
  const cliffDurationRef = useRef<HTMLInputElement>(null);
  const vestingFrequencyRef = useRef<HTMLSelectElement>(null);
  const voluntaryTerminationRef = useRef<HTMLInputElement>(null);
  const involuntaryTerminationRef = useRef<HTMLInputElement>(null);
  const terminationWithCauseRef = useRef<HTMLInputElement>(null);
  const deathExerciseRef = useRef<HTMLInputElement>(null);
  const disabilityExerciseRef = useRef<HTMLInputElement>(null);
  const retirementExerciseRef = useRef<HTMLInputElement>(null);

  const recipient = data.workers.find(({ id }) => id === recipientId);
  useEffect(() => {
    if (!recipientId) return;

    if (recipient?.salaried) {
      setGrantType("iso");
      setIssueDateRelationship("employee");
    } else {
      const lastGrant = recipient?.lastGrant;
      setGrantType(lastGrant?.optionGrantType ?? "nso");
      setIssueDateRelationship(lastGrant?.issueDateRelationship);
    }
  }, [recipientId]);

  useEffect(() => {
    if (!optionPool) return;

    setExpiryInMonths(optionPool.defaultOptionExpiryMonths);
    setVoluntaryTerminationExercisePeriodInMonths(optionPool.voluntaryTerminationExerciseMonths);
    setInvoluntaryTerminationExercisePeriodInMonths(optionPool.involuntaryTerminationExerciseMonths);
    setTerminationWithCauseExercisePeriodInMonths(optionPool.terminationWithCauseExerciseMonths);
    setDeathExercisePeriodInMonths(optionPool.deathExerciseMonths);
    setDisabilityExercisePeriodInMonths(optionPool.disabilityExerciseMonths);
    setRetirementExercisePeriodInMonths(optionPool.retirementExerciseMonths);
  }, [optionPoolId]);

  useEffect(() => {
    setVestingTrigger(
      !issueDateRelationship
        ? undefined
        : issueDateRelationship === "employee" || issueDateRelationship === "founder"
          ? "scheduled"
          : "invoice_paid",
    );
  }, [issueDateRelationship]);

  useEffect(() => {
    if (vestingTrigger !== "scheduled") {
      setVestingScheduleId(undefined);
    }
  }, [vestingTrigger]);

  useEffect(() => {
    if (vestingScheduleId !== "custom") {
      setTotalVestingDurationMonths(null);
      setCliffDurationMonths(null);
      setVestingFrequencyMonths(null);
    }
  }, [vestingScheduleId]);

  useEffect(
    () => setErrorInfo(null),
    [
      recipientId,
      optionPoolId,
      numberOfShares,
      issueDateRelationship,
      grantType,
      expiryInMonths,
      vestingTrigger,
      vestingScheduleId,
      vestingCommencementDate,
      totalVestingDurationMonths,
      cliffDurationMonths,
      vestingFrequencyMonths,
      voluntaryTerminationExercisePeriodInMonths,
      involuntaryTerminationExercisePeriodInMonths,
      terminationWithCauseExercisePeriodInMonths,
      deathExercisePeriodInMonths,
      disabilityExercisePeriodInMonths,
      retirementExercisePeriodInMonths,
    ],
  );

  const validate = () => {
    if (!recipientId) {
      setErrorInfo({ error: "Must be present.", attribute_name: "contractor" });
      recipientRef.current?.focus();
      return false;
    }

    if (!optionPoolId) {
      setErrorInfo({ error: "Must be present.", attribute_name: "option_pool" });
      optionPoolRef.current?.focus();
      return false;
    }

    if (!numberOfShares || numberOfShares <= 0) {
      setErrorInfo({ error: "Must be present and greater than 0.", attribute_name: "number_of_shares" });
      numberOfSharesRef.current?.focus();
      return false;
    }

    if (optionPool && optionPool.availableShares < numberOfShares) {
      setErrorInfo({
        error: `Not enough shares available in the option pool "${optionPool.name}" to create a grant with this number of options.`,
        attribute_name: "number_of_shares",
      });
      numberOfSharesRef.current?.focus();
      return false;
    }

    if (!issueDateRelationship) {
      setErrorInfo({ error: "Must be present.", attribute_name: "issue_date_relationship" });
      relationshipRef.current?.focus();
      return false;
    }

    if (grantType === "iso" && issueDateRelationship !== "employee" && issueDateRelationship !== "founder") {
      setErrorInfo({ error: "ISOs can only be issued to employees or founders.", attribute_name: "option_grant_type" });
      grantTypeRef.current?.focus();
      return false;
    }

    if (expiryInMonths === null || expiryInMonths < 0) {
      setErrorInfo({ error: "Must be present and greater than or equal to 0.", attribute_name: "expires_at" });
      expiryRef.current?.focus();
      return false;
    }

    if (!vestingTrigger) {
      setErrorInfo({ error: "Must be present.", attribute_name: "vesting_trigger" });
      vestingTriggerRef.current?.focus();
      return false;
    }

    if (vestingTrigger === "scheduled") {
      if (!vestingScheduleId) {
        setErrorInfo({ error: "Must be present.", attribute_name: "vesting_schedule_id" });
        vestingScheduleRef.current?.focus();
        return false;
      }

      if (!vestingCommencementDate) {
        setErrorInfo({ error: "Must be present.", attribute_name: "vesting_commencement_date" });
        vestingCommencementRef.current?.focus();
        return false;
      }

      if (vestingScheduleId === "custom") {
        if (!totalVestingDurationMonths || totalVestingDurationMonths <= 0) {
          setErrorInfo({
            error: "Must be present and greater than 0.",
            attribute_name: "total_vesting_duration_months",
          });
          totalVestingDurationRef.current?.focus();
          return false;
        }

        if (totalVestingDurationMonths > MAX_VESTING_DURATION_IN_MONTHS) {
          setErrorInfo({
            error: `Must not be more than ${MAX_VESTING_DURATION_IN_MONTHS} months (${MAX_VESTING_DURATION_IN_MONTHS / 12} years).`,
            attribute_name: "total_vesting_duration_months",
          });
          totalVestingDurationRef.current?.focus();
          return false;
        }

        if (cliffDurationMonths === null || cliffDurationMonths < 0) {
          setErrorInfo({
            error: "Must be present and greater than or equal to 0.",
            attribute_name: "cliff_duration_months",
          });
          cliffDurationRef.current?.focus();
          return false;
        }

        if (cliffDurationMonths >= totalVestingDurationMonths) {
          setErrorInfo({ error: "Must be less than total vesting duration.", attribute_name: "cliff_duration_months" });
          cliffDurationRef.current?.focus();
          return false;
        }

        if (!vestingFrequencyMonths) {
          setErrorInfo({ error: "Must be present.", attribute_name: "vesting_frequency_months" });
          vestingFrequencyRef.current?.focus();
          return false;
        }

        if (Number(vestingFrequencyMonths) > totalVestingDurationMonths) {
          setErrorInfo({
            error: "Must be less than total vesting duration.",
            attribute_name: "vesting_frequency_months",
          });
          vestingFrequencyRef.current?.focus();
          return false;
        }
      }
    }

    if (voluntaryTerminationExercisePeriodInMonths === null || voluntaryTerminationExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "voluntary_termination_exercise_months",
      });
      voluntaryTerminationRef.current?.focus();
      return false;
    }

    if (involuntaryTerminationExercisePeriodInMonths === null || involuntaryTerminationExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "involuntary_termination_exercise_months",
      });
      involuntaryTerminationRef.current?.focus();
      return false;
    }

    if (terminationWithCauseExercisePeriodInMonths === null || terminationWithCauseExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "termination_with_cause_exercise_months",
      });
      terminationWithCauseRef.current?.focus();
      return false;
    }

    if (deathExercisePeriodInMonths === null || deathExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "death_exercise_months",
      });
      deathExerciseRef.current?.focus();
      return false;
    }

    if (disabilityExercisePeriodInMonths === null || disabilityExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "disability_exercise_months",
      });
      disabilityExerciseRef.current?.focus();
      return false;
    }

    if (retirementExercisePeriodInMonths === null || retirementExercisePeriodInMonths < 0) {
      setErrorInfo({
        error: "Must be present and greater than or equal to 0.",
        attribute_name: "retirement_exercise_months",
      });
      retirementExerciseRef.current?.focus();
      return false;
    }

    setErrorInfo(null);
    return true;
  };

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
      const errorInfoSchema = z.object({
        error: z.string(),
        attribute_name: z
          .string()
          .nullable()
          .transform((value) => {
            if (!value) return null;
            const result = fieldAttributeName.safeParse(value);
            return result.success ? result.data : null;
          }),
      });

      const errorInfo = errorInfoSchema.parse(JSON.parse(error.message));
      setErrorInfo(errorInfo);
    },
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Invalid form data");

      const isCustomVestingSchedule = vestingTrigger === "scheduled" && vestingScheduleId === "custom";

      await createEquityGrant.mutateAsync({
        companyId: company.id,
        companyWorkerId: recipientId ?? "",
        optionPoolId: optionPoolId ?? "",
        numberOfShares: numberOfShares ?? 0,
        issueDateRelationship: issueDateRelationship ?? "employee",
        optionGrantType: grantType,
        optionExpiryMonths: expiryInMonths ?? 0,
        voluntaryTerminationExerciseMonths: voluntaryTerminationExercisePeriodInMonths ?? 0,
        involuntaryTerminationExerciseMonths: involuntaryTerminationExercisePeriodInMonths ?? 0,
        terminationWithCauseExerciseMonths: terminationWithCauseExercisePeriodInMonths ?? 0,
        deathExerciseMonths: deathExercisePeriodInMonths ?? 0,
        disabilityExerciseMonths: disabilityExercisePeriodInMonths ?? 0,
        retirementExerciseMonths: retirementExercisePeriodInMonths ?? 0,
        vestingTrigger: vestingTrigger ?? "scheduled",
        vestingScheduleId: isCustomVestingSchedule ? null : (vestingScheduleId ?? ""),
        vestingCommencementDate: vestingTrigger === "scheduled" ? vestingCommencementDate : null,
        totalVestingDurationMonths: isCustomVestingSchedule ? totalVestingDurationMonths : null,
        cliffDurationMonths: isCustomVestingSchedule ? cliffDurationMonths : null,
        vestingFrequencyMonths: isCustomVestingSchedule ? vestingFrequencyMonths : null,
      });
    },
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
      <FormSection title="Grant details">
        <CardContent className="grid gap-4">
          <fieldset>
            <Select
              label="Recipient"
              options={recipientOptions}
              value={recipientId}
              placeholder="Select recipient"
              onChange={setRecipientId}
              ref={recipientRef}
              {...invalidFieldAttrs("contractor", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <Select
              label="Option pool"
              options={optionPoolOptions}
              value={optionPoolId}
              placeholder="Select option pool"
              onChange={setOptionPoolId}
              ref={optionPoolRef}
              {...invalidFieldAttrs(
                "option_pool",
                errorInfo,
                optionPool
                  ? `Available shares in this option pool: ${optionPool.availableShares.toLocaleString()}`
                  : undefined,
              )}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Number of options"
              value={numberOfShares}
              placeholder="0"
              onChange={setNumberOfShares}
              ref={numberOfSharesRef}
              {...invalidFieldAttrs("number_of_shares", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <Select
              label="Relationship to company"
              options={Object.entries(relationshipDisplayNames).map(([key, value]) => ({ label: value, value: key }))}
              value={issueDateRelationship}
              placeholder="Select relationship"
              onChange={(v) => setIssueDateRelationship(isLiteralValue(v, relationshipDisplayNames) ? v : undefined)}
              ref={relationshipRef}
              {...invalidFieldAttrs("issue_date_relationship", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <Select
              label="Grant type"
              options={Object.entries(optionGrantTypeDisplayNames).map(([key, value]) => ({
                label: value,
                value: key,
              }))}
              value={grantType}
              onChange={(v) => isLiteralValue(v, optionGrantTypeDisplayNames) && setGrantType(v)}
              ref={grantTypeRef}
              {...invalidFieldAttrs("option_grant_type", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Expiry"
              value={expiryInMonths}
              placeholder="0"
              onChange={setExpiryInMonths}
              suffix="months"
              ref={expiryRef}
              {...invalidFieldAttrs(
                "expires_at",
                errorInfo,
                "If not exercised, options will expire after this period.",
              )}
            />
          </fieldset>
        </CardContent>
      </FormSection>
      <FormSection title="Vesting details">
        <CardContent className="grid gap-4">
          <fieldset>
            <Select
              label="Shares will vest"
              options={Object.entries(vestingTriggerDisplayNames).map(([key, value]) => ({ label: value, value: key }))}
              value={vestingTrigger}
              placeholder="Select an option"
              onChange={(v) => isLiteralValue(v, vestingTriggerDisplayNames) && setVestingTrigger(v)}
              ref={vestingTriggerRef}
              {...invalidFieldAttrs("vesting_trigger", errorInfo)}
            />
          </fieldset>
          {vestingTrigger === "scheduled" ? (
            <>
              <fieldset>
                <Select
                  label="Vesting schedule"
                  options={vestingScheduleOptions}
                  value={vestingScheduleId}
                  placeholder="Select a vesting schedule"
                  onChange={setVestingScheduleId}
                  ref={vestingScheduleRef}
                  {...invalidFieldAttrs("vesting_schedule_id", errorInfo)}
                />
              </fieldset>
              <fieldset>
                <Input
                  label="Vesting commencement date"
                  type="date"
                  value={vestingCommencementDate}
                  onChange={setVestingCommencementDate}
                  ref={vestingCommencementRef}
                  {...invalidFieldAttrs("vesting_commencement_date", errorInfo)}
                />
              </fieldset>
              {vestingScheduleId === "custom" ? (
                <>
                  <fieldset>
                    <NumberInput
                      label="Total vesting duration"
                      value={totalVestingDurationMonths}
                      placeholder="0"
                      onChange={setTotalVestingDurationMonths}
                      suffix="months"
                      ref={totalVestingDurationRef}
                      {...invalidFieldAttrs("total_vesting_duration_months", errorInfo)}
                    />
                  </fieldset>
                  <fieldset>
                    <NumberInput
                      label="Cliff period"
                      value={cliffDurationMonths}
                      placeholder="0"
                      onChange={setCliffDurationMonths}
                      suffix="months"
                      ref={cliffDurationRef}
                      {...invalidFieldAttrs("cliff_duration_months", errorInfo)}
                    />
                  </fieldset>
                  <fieldset>
                    <Select
                      label="Vesting frequency"
                      options={vestingFrequencyOptions}
                      value={vestingFrequencyMonths}
                      placeholder="Select vesting frequency"
                      onChange={setVestingFrequencyMonths}
                      ref={vestingFrequencyRef}
                      {...invalidFieldAttrs("vesting_frequency_months", errorInfo)}
                    />
                  </fieldset>
                </>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </FormSection>
      <FormSection title="Post-termination exercise periods">
        <CardContent className="grid gap-4">
          <fieldset>
            <NumberInput
              label="Voluntary termination exercise period"
              value={voluntaryTerminationExercisePeriodInMonths}
              placeholder="0"
              onChange={setVoluntaryTerminationExercisePeriodInMonths}
              suffix="months"
              ref={voluntaryTerminationRef}
              {...invalidFieldAttrs("voluntary_termination_exercise_months", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Involuntary termination exercise period"
              value={involuntaryTerminationExercisePeriodInMonths}
              placeholder="0"
              onChange={setInvoluntaryTerminationExercisePeriodInMonths}
              suffix="months"
              ref={involuntaryTerminationRef}
              {...invalidFieldAttrs("involuntary_termination_exercise_months", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Termination with cause exercise period"
              value={terminationWithCauseExercisePeriodInMonths}
              placeholder="0"
              onChange={setTerminationWithCauseExercisePeriodInMonths}
              suffix="months"
              ref={terminationWithCauseRef}
              {...invalidFieldAttrs("termination_with_cause_exercise_months", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Death exercise period"
              value={deathExercisePeriodInMonths}
              placeholder="0"
              onChange={setDeathExercisePeriodInMonths}
              suffix="months"
              ref={deathExerciseRef}
              {...invalidFieldAttrs("death_exercise_months", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Disability exercise period"
              value={disabilityExercisePeriodInMonths}
              placeholder="0"
              onChange={setDisabilityExercisePeriodInMonths}
              suffix="months"
              ref={disabilityExerciseRef}
              {...invalidFieldAttrs("disability_exercise_months", errorInfo)}
            />
          </fieldset>
          <fieldset>
            <NumberInput
              label="Retirement exercise period"
              value={retirementExercisePeriodInMonths}
              placeholder="0"
              onChange={setRetirementExercisePeriodInMonths}
              suffix="months"
              ref={retirementExerciseRef}
              {...invalidFieldAttrs("retirement_exercise_months", errorInfo)}
            />
          </fieldset>
        </CardContent>
      </FormSection>
      <div className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]">
        <div></div>
        <div className="grid gap-2">
          {errorInfo?.attribute_name === null ? (
            <div className="text-red text-center text-xs">{errorInfo.error}</div>
          ) : null}
          <MutationButton mutation={submitMutation}>Create option grant</MutationButton>
        </div>
      </div>
    </MainLayout>
  );
}
