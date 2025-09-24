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

type EquityGrant = RouterOutput["equityGrants"]["list"][number];

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
  const { data: fullEquityGrant } = trpc.equityGrants.get.useQuery({ companyId: company.id, id: equityGrant.id });

  const processedVestingEvents =
    fullEquityGrant?.vestingEvents.filter((event) => event.processedAt && !event.cancelledAt) ?? [];

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{`${equityGrant.periodEndedAt.getFullYear()} Stock option grant`}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 pb-6 not-print:overflow-y-auto">
          <Item
            label="Total options granted"
            value={`${equityGrant.numberOfShares.toLocaleString()} (${optionGrantTypeDisplayNames[equityGrant.optionGrantType]})`}
          />
          <Item label="Unvested" value={equityGrant.unvestedShares.toLocaleString()} />
          {equityGrant.exercisedShares > 0 ? (
            <Item label="Options exercised" value={equityGrant.exercisedShares.toLocaleString()} />
          ) : null}
          {equityGrant.forfeitedShares > 0 ? (
            <Item label="Options forfeited" value={equityGrant.forfeitedShares.toLocaleString()} />
          ) : null}
          {equityGrant.vestedShares > 0 ? (
            <Item label="Vested" value={equityGrant.vestedShares.toLocaleString()} />
          ) : null}
          {equityGrant.unvestedShares > 0 ? (
            <Item label="Forfeits if unvested on" value={formatDate(equityGrant.periodEndedAt)} />
          ) : null}
          <Item
            label="Status"
            value={
              equityGrant.numberOfShares === equityGrant.forfeitedShares
                ? "Fully forfeited"
                : equityGrant.numberOfShares === equityGrant.exercisedShares
                  ? "Fully exercised"
                  : equityGrant.exercisedShares > 0
                    ? "Partially exercised"
                    : equityGrant.numberOfShares === equityGrant.vestedShares
                      ? "Fully vested"
                      : "Outstanding"
            }
          />
          <Separator />

          <h3 className="text-md px-6 font-medium">Exercise key dates</h3>
          <Item label="Grant date" value={formatDate(equityGrant.issuedAt)} />
          <Item label="Accepted on" value={equityGrant.acceptedAt ? formatDate(equityGrant.acceptedAt) : "N/A"} />
          <Item label="Expires on" value={formatDate(equityGrant.expiresAt)} />
          <Separator />

          <h3 className="text-md px-6 font-medium">Exercise details</h3>
          <Item
            label="Exercise price"
            value={`${formatMoney(equityGrant.exercisePriceUsd, { precise: true })} per share`}
          />
          <Item label="Vested options" value={equityGrant.vestedShares.toLocaleString()} />
          {equityGrant.vestedShares > 0 ? (
            <Item
              label="Exercise cost"
              value={formatMoney(new Decimal(equityGrant.exercisePriceUsd).mul(equityGrant.vestedShares), {
                precise: true,
              })}
            />
          ) : null}
          <Separator />

          <h3 className="text-md px-6 font-medium">Post-termination exercise windows</h3>
          <Item label="Voluntary" value={humanizeMonths(equityGrant.voluntaryTerminationExerciseMonths)} />
          <Item label="Involuntary" value={humanizeMonths(equityGrant.involuntaryTerminationExerciseMonths)} />
          <Item label="With cause" value={humanizeMonths(equityGrant.terminationWithCauseExerciseMonths)} />
          <Item label="Death" value={humanizeMonths(equityGrant.deathExerciseMonths)} />
          <Item label="Disability" value={humanizeMonths(equityGrant.disabilityExerciseMonths)} />
          <Item label="Retirement" value={humanizeMonths(equityGrant.retirementExerciseMonths)} />
          <Separator />

          <h3 className="text-md px-6 font-medium">Compliance details</h3>
          <Item
            label="Board approved on"
            value={equityGrant.boardApprovalDate ? formatDate(equityGrant.boardApprovalDate) : "N/A"}
          />
          <Item
            label="Residency"
            value={
              user.address.countryCode === "US"
                ? `${user.address.stateCode}, US`
                : (countries.get(user.address.countryCode ?? "") ?? user.address.countryCode ?? "N/A")
            }
          />
          <Item label="Role type" value={relationshipDisplayNames[equityGrant.issueDateRelationship]} />

          {processedVestingEvents.length > 0 ? (
            <>
              <Separator />
              <h3 className="text-md px-6 font-medium">Vesting events</h3>
              {processedVestingEvents.map((event) => (
                <div key={event.id}>
                  <Item label={formatDate(event.vestingDate)} value={`${event.vestedShares.toLocaleString()} shares`} />
                </div>
              ))}
            </>
          ) : null}
        </div>
        {company.flags.includes("option_exercising") &&
        equityGrant.vestedShares > 0 &&
        isFuture(equityGrant.expiresAt) &&
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
