import { useMutation } from "@tanstack/react-query";
import { Decimal } from "decimal.js";
import { Fragment, useId, useState } from "react";
import { z } from "zod";
import Form, { customCss } from "@/app/(dashboard)/documents/DocusealForm";
import Delta from "@/components/Delta";
import RangeInput from "@/components/RangeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import env from "@/env/client";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_equity_grant_exercises_path } from "@/utils/routes";

type EquityGrant = RouterOutput["equityGrants"]["list"][number];

const ExerciseModal = ({
  equityGrants,
  companySharePrice,
  companyValuation,
  onClose,
}: {
  equityGrants: EquityGrant[];
  companySharePrice: string;
  companyValuation: number;
  onClose: () => void;
}) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const uid = useId();
  const [optionsToExercise, setOptionsToExercise] = useState(0);
  const [selectedGrantIds, setSelectedGrantIds] = useState<string[]>(() =>
    equityGrants.length === 1 && equityGrants[0]?.id ? [equityGrants[0].id] : [],
  );
  const [signing, setSigning] = useState(false);
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

  const maxExercisableOptions = [...selectedGrants].reduce((total, [grant]) => total + grant.vestedShares, 0);

  const totalExerciseCost = [...selectedGrants].reduce(
    (total, [grant, options]) => total.add(new Decimal(options).mul(grant.exercisePriceUsd)),
    new Decimal(0),
  );

  const equityValueDelta = totalExerciseCost.eq(0)
    ? 0
    : new Decimal(optionsToExercise).mul(companySharePrice).sub(totalExerciseCost).div(totalExerciseCost).toNumber();

  const trpcUtils = trpc.useUtils();
  const submitMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      if (optionsToExercise === 0) throw new Error("No options to exercise");
      const equityGrants = [...selectedGrants].map(([grant, options]) => ({
        id: grant.id,
        number_of_options: options,
      }));

      await request({
        method: "POST",
        url: company_equity_grant_exercises_path(company.id),
        accept: "json",
        jsonData: { equity_grants: equityGrants, submission_id: submissionId },
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
        {signing ? (
          <Form
            src={`https://docuseal.com/d/${env.NEXT_PUBLIC_EQUITY_EXERCISE_DOCUSEAL_ID}`}
            externalId={new Date().toISOString()}
            customCss={customCss}
            onComplete={(data) =>
              submitMutation.mutate(z.object({ submission_id: z.number() }).parse(data).submission_id)
            }
            values={{
              __companyName: company.name,
              __name: user.legalName,
              __email: user.email,
              __address1: user.address.street_address,
              __address2: `${user.address.city}, ${user.address.state} ${user.address.zip_code}`,
              __address3: user.address.country,
            }}
          />
        ) : (
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
                        Based on {companyValuation.toLocaleString([], { notation: "compact" })} valuation
                      </span>
                    </div>
                    <div className="text-right">
                      {formatMoney(new Decimal(optionsToExercise).mul(companySharePrice))}
                      <br />
                      <span className="flex justify-end text-sm">
                        <Delta diff={equityValueDelta} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        <DialogFooter>
          <Button onClick={() => setSigning(true)} disabled={optionsToExercise === 0}>
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseModal;
