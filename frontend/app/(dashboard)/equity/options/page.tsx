"use client";

import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isFuture } from "date-fns";
import { Decimal } from "decimal.js";
import { CircleCheck, Info } from "lucide-react";
import { forbidden } from "next/navigation";
import { Fragment, useId, useState } from "react";
import DetailsModal from "@/app/(dashboard)/equity/grants/DetailsModal";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Delta from "@/components/Delta";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import RangeInput from "@/components/RangeInput";
import SignForm from "@/components/SignForm";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_equity_grant_exercises_path, resend_company_equity_grant_exercise_path } from "@/utils/routes";
import { useExerciseDataConfig } from ".";

type EquityGrant = RouterOutput["equityGrants"]["list"][number];
const investorGrantColumnHelper = createColumnHelper<EquityGrant>();
const investorGrantColumns = [
  investorGrantColumnHelper.simple("periodStartedAt", "Period", (v) => new Date(v).getFullYear(), "numeric"),
  investorGrantColumnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
  investorGrantColumnHelper.simple(
    "exercisePriceUsd",
    "Exercise price",
    (v) => formatMoney(v, { precise: true }),
    "numeric",
  ),
];

export default function OptionsPage() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  if (!user.roles.investor) forbidden();
  const { data = [], isLoading } = trpc.equityGrants.list.useQuery({
    companyId: company.id,
    investorId: user.roles.investor.id,
    orderBy: "periodEndedAt" as const,
    eventuallyExercisable: true,
    accepted: true,
  });
  const { data: exerciseData } = useQuery(useExerciseDataConfig());
  const [selectedEquityGrant, setSelectedEquityGrant] = useState<EquityGrant | null>(null);
  const [exercisableGrants, setExercisableGrants] = useState<EquityGrant[]>([]);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  const table = useTable({ columns: investorGrantColumns, data });

  const totalUnexercisedVestedShares = data.reduce((acc, grant) => {
    if (!grant.activeExercise && isFuture(new Date(grant.expiresAt))) {
      return acc + grant.vestedShares;
    }
    return acc;
  }, 0);
  const exerciseInProgress = data.find((grant) => grant.activeExercise)?.activeExercise;

  const openExerciseModal = () => {
    const grants = data.filter(
      (grant) => !grant.activeExercise && grant.vestedShares > 0 && isFuture(new Date(grant.expiresAt)),
    );

    if (grants.length > 0) {
      setExercisableGrants(grants);
      setShowExerciseModal(true);
    }
  };

  const exerciseGrant = () => {
    if (selectedEquityGrant) {
      setExercisableGrants([selectedEquityGrant]);
      setSelectedEquityGrant(null);
      setShowExerciseModal(true);
    }
  };

  const resendPaymentInstructions = useMutation({
    mutationFn: async (exerciseId: bigint) => {
      await request({
        method: "POST",
        url: resend_company_equity_grant_exercise_path(company.id, exerciseId),
        assertOk: true,
        accept: "json",
      });
    },
    onSuccess: () => setTimeout(() => resendPaymentInstructions.reset(), 5000),
  });

  return (
    <>
      <DashboardHeader title="Options" />
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : data.length === 0 ? (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>You don't have any option grants right now.</Placeholder>
        </div>
      ) : (
        <>
          {company.flags.includes("option_exercising") && exerciseData?.exercise_notice ? (
            <>
              {totalUnexercisedVestedShares > 0 && !exerciseInProgress && (
                <Alert className="mx-4 mb-4">
                  <Info />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        You have {totalUnexercisedVestedShares.toLocaleString()} vested options available for exercise.
                      </span>
                      <Button size="small" onClick={openExerciseModal}>
                        Exercise Options
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {exerciseInProgress ? (
                <Alert className="mx-4 mb-4">
                  <Info />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        We're awaiting a payment of {formatMoneyFromCents(exerciseInProgress.totalCostCents)} to
                        exercise {exerciseInProgress.numberOfOptions.toLocaleString()} options.
                      </span>
                      <MutationButton
                        size="small"
                        mutation={resendPaymentInstructions}
                        param={exerciseInProgress.id}
                        successText="Payment instructions sent!"
                      >
                        Resend payment instructions
                      </MutationButton>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : null}

          <DataTable table={table} onRowClicked={setSelectedEquityGrant} />

          {selectedEquityGrant ? (
            <DetailsModal
              equityGrant={selectedEquityGrant}
              userId={selectedEquityGrant.user.id}
              canExercise={!exerciseInProgress}
              onClose={() => setSelectedEquityGrant(null)}
              onUpdateExercise={exerciseGrant}
            />
          ) : null}

          {showExerciseModal ? (
            <ExerciseModal equityGrants={exercisableGrants} onClose={() => setShowExerciseModal(false)} />
          ) : null}
        </>
      )}
    </>
  );
}

const ExerciseModal = ({ equityGrants, onClose }: { equityGrants: EquityGrant[]; onClose: () => void }) => {
  const company = useCurrentCompany();
  const uid = useId();
  const [optionsToExercise, setOptionsToExercise] = useState(0);
  const [selectedGrantIds, setSelectedGrantIds] = useState<string[]>(() =>
    equityGrants.length === 1 && equityGrants[0]?.id ? [equityGrants[0].id] : [],
  );
  const [state, setState] = useState<"initial" | "signing" | "signed">("initial");
  let remaining = optionsToExercise;
  const selectedGrants = new Map(
    selectedGrantIds.map((id) => {
      const grant = assertDefined(equityGrants.find((g) => g.id === id));
      const toExercise = Math.min(remaining, grant.vestedShares);
      remaining -= toExercise;
      return [grant, toExercise];
    }),
  );
  const sortedGrants = [...equityGrants].sort((a, b) => {
    if (a.exercisePriceUsd !== b.exercisePriceUsd) {
      return new Decimal(a.exercisePriceUsd).sub(b.exercisePriceUsd).toNumber();
    }
    return a.issuedAt.getTime() - b.issuedAt.getTime();
  });
  const { data: exerciseData } = useSuspenseQuery(useExerciseDataConfig());

  const maxExercisableOptions = [...selectedGrants].reduce((total, [grant]) => total + grant.vestedShares, 0);

  const totalExerciseCost = [...selectedGrants].reduce(
    (total, [grant, options]) => total.add(new Decimal(options).mul(grant.exercisePriceUsd)),
    new Decimal(0),
  );

  const sharePrice = company.sharePriceInUsd ?? 0;
  const equityValueDelta = totalExerciseCost.eq(0)
    ? 0
    : new Decimal(optionsToExercise).mul(sharePrice).sub(totalExerciseCost).div(totalExerciseCost).toNumber();

  const trpcUtils = trpc.useUtils();
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (optionsToExercise === 0) throw new Error("No options to exercise");
      const equityGrants = [...selectedGrants].map(([grant, options]) => ({
        id: grant.id,
        number_of_options: options,
      }));

      await request({
        method: "POST",
        url: company_equity_grant_exercises_path(company.id),
        accept: "json",
        jsonData: { equity_grants: equityGrants },
        assertOk: true,
      });
      await trpcUtils.equityGrants.list.refetch();
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="ml-auto max-w-prose md:mr-0">
        <DialogHeader>
          <DialogTitle>Exercise your options</DialogTitle>
        </DialogHeader>
        {state === "initial" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-options-to-exercise`}>Options to exercise</Label>
              <RangeInput
                id={`${uid}-options-to-exercise`}
                value={optionsToExercise}
                onChange={setOptionsToExercise}
                aria-invalid={submitMutation.isError}
                min={selectedGrantIds.length > 0 ? 1 : 0}
                max={maxExercisableOptions}
              />
            </div>

            <Card className="mt-4">
              <CardContent>
                {sortedGrants.map((grant, index) => (
                  <Fragment key={grant.id}>
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        {sortedGrants.length > 1 ? (
                          <Checkbox
                            checked={selectedGrants.has(grant)}
                            label={`${grant.periodStartedAt.getFullYear()} Grant at ${formatMoney(
                              grant.exercisePriceUsd,
                            )} / share`}
                            disabled={selectedGrantIds.length === 1 && selectedGrants.has(grant)}
                            onCheckedChange={() => {
                              setSelectedGrantIds(
                                selectedGrants.has(grant)
                                  ? selectedGrantIds.filter((id) => id !== grant.id)
                                  : [...selectedGrantIds, grant.id],
                              );
                            }}
                          />
                        ) : (
                          <span>
                            {grant.periodStartedAt.getFullYear()} Grant at {formatMoney(grant.exercisePriceUsd)} / share
                          </span>
                        )}
                        <span className="min-w-[17ch] text-right tabular-nums">
                          <span className={selectedGrants.get(grant) ? "font-bold" : ""}>
                            {(selectedGrants.get(grant) ?? 0).toLocaleString()}
                          </span>{" "}
                          of {grant.vestedShares.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-gray-200">
                        <div
                          className="h-1 rounded-full bg-black"
                          style={{
                            width: `${((selectedGrants.get(grant) ?? 0) / grant.vestedShares) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    {index !== sortedGrants.length - 1 && <Separator />}
                  </Fragment>
                ))}
              </CardContent>
            </Card>

            <div className="mt-4 grid">
              <h3 className="mb-2">Summary</h3>
              <Card>
                <CardContent>
                  <div className="flex justify-between gap-2 font-bold">
                    <div>Exercise cost</div>
                    <div>{formatMoney(totalExerciseCost)}</div>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <div>Payment method</div>
                    <div>Bank transfer</div>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <div>
                      Options value
                      <br />
                      <span className="text-sm text-gray-600">
                        Based on {(company.valuationInDollars ?? 0).toLocaleString([], { notation: "compact" })}{" "}
                        valuation
                      </span>
                    </div>
                    <div className="text-right">
                      {formatMoney(new Decimal(optionsToExercise).mul(sharePrice))}
                      <br />
                      <span className="flex justify-end text-sm">
                        <Delta diff={equityValueDelta} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button onClick={() => setState("signing")} disabled={optionsToExercise === 0}>
                Proceed
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <SignForm
              content={exerciseData.exercise_notice ?? ""}
              signed={state === "signed"}
              onSign={() => setState("signed")}
            />
            <DialogFooter>
              <MutationButton mutation={submitMutation} disabled={state !== "signed"}>
                Sign and submit
              </MutationButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
