import { isFuture } from "date-fns";
import Decimal from "decimal.js";
import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate, humanizeMonths } from "@/utils/time";
import { optionGrantTypeDisplayNames, relationshipDisplayNames } from ".";

type EquityGrant = RouterOutput["equityGrants"]["get"];

const Item = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 px-6">
    <div className="text-muted-foreground text-sm">{label}</div>
    <div className="text-right text-sm">{value}</div>
  </div>
);

const DetailsModal = ({
  equityGrant,
  userId,
  canExercise,
  onUpdateExercise,
  onClose,
}: {
  equityGrant: EquityGrant;
  userId: string;
  canExercise: boolean;
  onUpdateExercise?: () => void;
  onClose: () => void;
}) => {
  const company = useCurrentCompany();
  const [user] = trpc.users.get.useSuspenseQuery({ companyId: company.id, id: userId });
  const [detailedGrant] = trpc.equityGrants.get.useSuspenseQuery({ companyId: company.id, id: equityGrant.id });

  if (!detailedGrant) return null;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{`${detailedGrant.periodEndedAt.getFullYear()} Stock option grant`}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 pb-6 not-print:overflow-y-auto">
          <Item
            label="Total options granted"
            value={`${detailedGrant.numberOfShares.toLocaleString()} (${optionGrantTypeDisplayNames[detailedGrant.optionGrantType]})`}
          />
          <Item label="Unvested" value={detailedGrant.unvestedShares.toLocaleString()} />
          {detailedGrant.exercisedShares > 0 ? (
            <Item label="Options exercised" value={detailedGrant.exercisedShares.toLocaleString()} />
          ) : null}
          {detailedGrant.forfeitedShares > 0 ? (
            <Item label="Options forfeited" value={detailedGrant.forfeitedShares.toLocaleString()} />
          ) : null}
          {detailedGrant.vestedShares > 0 ? (
            <Item label="Vested" value={detailedGrant.vestedShares.toLocaleString()} />
          ) : null}
          {detailedGrant.unvestedShares > 0 ? (
            <Item label="Forfeits if unvested on" value={formatDate(detailedGrant.periodEndedAt)} />
          ) : null}
          <Item
            label="Status"
            value={
              detailedGrant.numberOfShares === detailedGrant.forfeitedShares
                ? "Fully forfeited"
                : detailedGrant.numberOfShares === detailedGrant.exercisedShares
                  ? "Fully exercised"
                  : detailedGrant.exercisedShares > 0
                    ? "Partially exercised"
                    : detailedGrant.numberOfShares === detailedGrant.vestedShares
                      ? "Fully vested"
                      : "Outstanding"
            }
          />
          <Separator />

          <h3 className="text-md px-6 font-medium">Exercise key dates</h3>
          <Item label="Grant date" value={formatDate(detailedGrant.issuedAt)} />
          <Item label="Accepted on" value={detailedGrant.acceptedAt ? formatDate(detailedGrant.acceptedAt) : "N/A"} />
          <Item label="Expires on" value={formatDate(detailedGrant.expiresAt)} />
          <Separator />

          <h3 className="text-md px-6 font-medium">Exercise details</h3>
          <Item
            label="Exercise price"
            value={`${formatMoney(detailedGrant.exercisePriceUsd, { precise: true })} per share`}
          />
          <Item label="Vested options" value={detailedGrant.vestedShares.toLocaleString()} />
          {detailedGrant.vestedShares > 0 ? (
            <Item
              label="Exercise cost"
              value={formatMoney(new Decimal(detailedGrant.exercisePriceUsd).mul(detailedGrant.vestedShares), {
                precise: true,
              })}
            />
          ) : null}
          <Separator />

          <h3 className="text-md px-6 font-medium">Post-termination exercise windows</h3>
          <Item label="Voluntary" value={humanizeMonths(detailedGrant.voluntaryTerminationExerciseMonths)} />
          <Item label="Involuntary" value={humanizeMonths(detailedGrant.involuntaryTerminationExerciseMonths)} />
          <Item label="With cause" value={humanizeMonths(detailedGrant.terminationWithCauseExerciseMonths)} />
          <Item label="Death" value={humanizeMonths(detailedGrant.deathExerciseMonths)} />
          <Item label="Disability" value={humanizeMonths(detailedGrant.disabilityExerciseMonths)} />
          <Item label="Retirement" value={humanizeMonths(detailedGrant.retirementExerciseMonths)} />
          <Separator />

          <h3 className="text-md px-6 font-medium">Compliance details</h3>
          <Item
            label="Board approved on"
            value={detailedGrant.boardApprovalDate ? formatDate(detailedGrant.boardApprovalDate) : "N/A"}
          />
          <Item
            label="Residency"
            value={
              user.address.countryCode === "US"
                ? `${user.address.stateCode}, US`
                : (countries.get(user.address.countryCode ?? "") ?? user.address.countryCode ?? "N/A")
            }
          />
          <Item label="Role type" value={relationshipDisplayNames[detailedGrant.issueDateRelationship]} />

          {detailedGrant.vestingEvents.length > 0 ? (
            <>
              <Separator />
              <h3 className="text-md px-6 font-medium">Vesting events</h3>
              {detailedGrant.vestingEvents.map((event) => (
                <Item
                  key={event.id}
                  label={formatDate(event.vestingDate)}
                  value={`${event.vestedShares.toLocaleString()} shares`}
                />
              ))}
            </>
          ) : null}
        </div>
        {company.flags.includes("option_exercising") &&
        detailedGrant.vestedShares > 0 &&
        isFuture(detailedGrant.expiresAt) &&
        canExercise ? (
          <SheetFooter>
            <div className="grid gap-4">
              <Button onClick={onUpdateExercise}>Exercise options</Button>
              <div className="text-xs">You can choose how many options to exercise in the next step.</div>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default DetailsModal;
