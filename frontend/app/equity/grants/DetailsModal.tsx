import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { isFuture } from "date-fns";
import Decimal from "decimal.js";
import React, { Fragment } from "react";
import { linkClasses } from "@/components/Link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const firstBoxDetails = [
    {
      label: "Options received",
      value: `${equityGrant.numberOfShares.toLocaleString()} (${optionGrantTypeDisplayNames[equityGrant.optionGrantType]})`,
      tooltip: `Options issued to you on ${formatDate(equityGrant.issuedAt)}`,
    },
    { label: "Available for vesting", value: equityGrant.unvestedShares.toLocaleString(), tooltip: null },
    equityGrant.exercisedShares > 0
      ? {
          label: "Options exercised",
          value: equityGrant.exercisedShares.toLocaleString(),
          tooltip: "Options you've already exercised",
        }
      : null,
    equityGrant.unvestedShares > 0
      ? {
          label: "Vest before",
          value: formatDate(equityGrant.periodEndedAt),
          tooltip: "Options not vested by this date will be forfeited",
        }
      : null,
    equityGrant.forfeitedShares > 0
      ? {
          label: "Options forfeited",
          value: equityGrant.forfeitedShares.toLocaleString(),
          tooltip: `Options you didn't vest during ${equityGrant.issuedAt.getFullYear()}`,
        }
      : null,
    equityGrant.vestedShares > 0
      ? {
          label: "Available for exercising",
          value: equityGrant.vestedShares.toLocaleString(),
          tooltip: "Options you can exercise",
        }
      : null,
    {
      label: "Status",
      ...(equityGrant.numberOfShares === equityGrant.forfeitedShares
        ? { value: "Fully forfeited", tooltip: "All options have been forfeited" }
        : equityGrant.numberOfShares === equityGrant.exercisedShares
          ? { value: "Fully exercised", tooltip: "All options have been exercised" }
          : equityGrant.exercisedShares > 0
            ? { value: "Partially exercised", tooltip: "Some options have been exercised" }
            : equityGrant.numberOfShares === equityGrant.vestedShares
              ? { value: "Fully vested", tooltip: "All options have been vested" }
              : { value: "Outstanding" }),
    },
  ].filter((item) => !!item);

  const secondBoxDetails = [
    {
      label: "Exercise price",
      value: formatMoney(equityGrant.exercisePriceUsd, { precise: true }),
      tooltip: "Price per share to exercise your vested options",
    },
    equityGrant.vestedShares > 0
      ? {
          label: "Full exercise cost",
          value: formatMoney(new Decimal(equityGrant.exercisePriceUsd).mul(equityGrant.vestedShares), {
            precise: true,
          }),
          tooltip: "Cost to exercise 100% of your vested options",
        }
      : null,
    equityGrant.exercisedShares > 0
      ? {
          label: "Cash paid",
          value: formatMoney(new Decimal(equityGrant.exercisePriceUsd).mul(equityGrant.exercisedShares), {
            precise: true,
          }),
          tooltip: "Total amount paid to exercise your options",
        }
      : null,
  ].filter((item) => !!item);

  const thirdBoxDetails = [
    { label: "Grant date", value: formatDate(equityGrant.issuedAt), tooltip: null },
    {
      label: "Expiration date",
      value: formatDate(equityGrant.expiresAt),
      tooltip: "Options not exercised by this date will expire",
    },
    {
      label: "Accepted on",
      value: equityGrant.acceptedAt ? formatDate(equityGrant.acceptedAt) : "N/A",
    },
  ];

  const postTerminationExercisePeriods = [
    { label: "Voluntary termination", value: humanizeMonths(equityGrant.voluntaryTerminationExerciseMonths) },
    { label: "Involuntary termination", value: humanizeMonths(equityGrant.involuntaryTerminationExerciseMonths) },
    { label: "Termination with cause", value: humanizeMonths(equityGrant.terminationWithCauseExerciseMonths) },
    { label: "Death", value: humanizeMonths(equityGrant.deathExerciseMonths) },
    { label: "Disability", value: humanizeMonths(equityGrant.disabilityExerciseMonths) },
    { label: "Retirement", value: humanizeMonths(equityGrant.retirementExerciseMonths) },
  ];

  const boxDetails = [firstBoxDetails, secondBoxDetails, thirdBoxDetails];

  const complianceDetails = React.useMemo(
    () => [
      {
        label: "Board approval date",
        value: equityGrant.boardApprovalDate ? formatDate(equityGrant.boardApprovalDate) : "N/A",
      },
      {
        label: "State/Country of Residency",
        value:
          user.address.countryCode === "US"
            ? `${user.address.stateCode}, US`
            : (countries.get(user.address.countryCode ?? "") ?? user.address.countryCode),
      },
      {
        label: "Relationship to company",
        value: relationshipDisplayNames[equityGrant.issueDateRelationship],
      },
    ],
    [equityGrant],
  );

  const additionalAgreements: { name: string; url: string }[] = [
    // { name: "Stockholder Agreement", url: "#" },
    // { name: "Right of First Refusal and Co-Sale Agreement", url: "#" },
    // { name: "Voting Agreement", url: "#" },
  ];

  const rightsAndPreferences: { name: string; option: string | null }[] = [
    // { name: "Liquidation preference", option: "1x" },
    // { name: "Dividend rights", option: null },
    // { name: "Conversion rights", option: null },
    // { name: "Anti-dilution protection", option: null },
    // { name: "Voting rights", option: "1 vote per share" },
  ];

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{`${equityGrant.periodEndedAt.getFullYear()} Stock Option Grant`}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 p-4 pt-0 not-print:overflow-y-auto">
          {boxDetails.map((details, index) => (
            <Card key={index}>
              <CardContent>
                {details.map((detail, i) => (
                  <Fragment key={i}>
                    <div className="flex justify-between gap-2">
                      <div className="inline-flex gap-1">
                        {detail.label}
                        {detail.tooltip ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <QuestionMarkCircleIcon className="size-4 print:hidden" />
                            </TooltipTrigger>
                            <TooltipContent>{detail.tooltip}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div>{detail.value}</div>
                    </div>
                    {i !== details.length - 1 && <Separator />}
                  </Fragment>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Post-termination exercise periods</CardTitle>
            </CardHeader>
            <CardContent>
              {postTerminationExercisePeriods.map((detail, index) => (
                <Fragment key={index}>
                  <div className="flex justify-between gap-4">
                    <div>{detail.label}</div>
                    <div>{detail.value}</div>
                  </div>
                  {index !== postTerminationExercisePeriods.length - 1 && <Separator />}
                </Fragment>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Details</CardTitle>
            </CardHeader>
            <CardContent>
              {complianceDetails.map((detail, index) => (
                <Fragment key={index}>
                  <div className="flex justify-between gap-4">
                    <div>{detail.label}</div>
                    <div>{detail.value}</div>
                  </div>
                  {index !== complianceDetails.length - 1 && <Separator />}
                </Fragment>
              ))}
            </CardContent>
          </Card>

          {additionalAgreements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Agreements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {additionalAgreements.map((detail, index) => (
                    <li key={index} className="list-inside list-disc">
                      <a href={detail.url} target="_blank" className={linkClasses} rel="noreferrer">
                        {detail.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {rightsAndPreferences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rights and Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {rightsAndPreferences.map((detail, index) => (
                    <li key={index} className="list-inside list-disc">
                      {detail.name}
                      {detail.option ? `: ${detail.option}` : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
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
