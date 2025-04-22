"use client";
import { PencilIcon } from "@heroicons/react/16/solid";
import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { isFuture } from "date-fns";
import { Decimal } from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Figures from "@/components/Figures";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DocumentTemplateType } from "@/db/enums";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";
import { request } from "@/utils/request";
import { resend_company_equity_grant_exercise_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";
import DetailsModal from "./DetailsModal";
import ExerciseModal from "./ExerciseModal";
import { useInvestorQueryParams } from "./";

type EquityGrantList = RouterOutput["equityGrants"]["list"];
type EquityGrant = EquityGrantList[number];
type OptionHolderCountry = RouterOutput["equityGrants"]["byCountry"][number];

const countryColumnHelper = createColumnHelper<OptionHolderCountry>();
const countryColumns = [
  countryColumnHelper.simple("countryCode", "Country", (v) => countries.get(v ?? "") ?? v),
  countryColumnHelper.simple("optionHolders", "Number of option holders", (v) => v.toLocaleString(), "numeric"),
];

export default function EquityGrants() {
  const user = useCurrentUser();

  return user.activeRole === "contractorOrInvestor" ? <InvestorGrantList /> : <CompanyGrantList />;
}

const companyGrantColumnHelper = createColumnHelper<EquityGrant>();
const companyGrantColumns = [
  companyGrantColumnHelper.accessor("optionHolderName", {
    header: "Contractor",
    cell: (info) => (
      <Link href={`/people/${info.row.original.user.id}`} className="no-underline">
        {info.row.original.optionHolderName}
      </Link>
    ),
  }),
  companyGrantColumnHelper.simple("issuedAt", "Issue date", formatDate),
  companyGrantColumnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
  companyGrantColumnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
  companyGrantColumnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
  companyGrantColumnHelper.simple("exercisedShares", "Exercised", (v) => v.toLocaleString(), "numeric"),
  companyGrantColumnHelper.simple(
    "exercisePriceUsd",
    "Exercise price",
    (v) => formatMoney(v, { precise: true }),
    "numeric",
  ),
];

const CompanyGrantList = () => {
  const router = useRouter();
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.list.useSuspenseQuery({ companyId: company.id });
  const [totals] = trpc.equityGrants.totals.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns: companyGrantColumns, data });
  const [equityPlanContractTemplates] = trpc.documents.templates.list.useSuspenseQuery({
    companyId: company.id,
    type: DocumentTemplateType.EquityPlanContract,
    signable: true,
  });
  const [boardConsentTemplates] = trpc.documents.templates.list.useSuspenseQuery({
    companyId: company.id,
    type: DocumentTemplateType.BoardConsent,
    signable: true,
  });

  const totalGrantedShares = totals.unvestedShares + totals.vestedShares + totals.exercisedShares;

  const [countriesData] = trpc.equityGrants.byCountry.useSuspenseQuery({ companyId: company.id });
  const optionHolderCountriesTable = useTable({ columns: countryColumns, data: countriesData });

  return (
    <EquityLayout
      headerActions={
        equityPlanContractTemplates.length > 0 && boardConsentTemplates.length > 0 ? (
          <Button asChild>
            <Link href={`/companies/${company.id}/administrator/equity_grants/new`}>
              <PencilIcon className="size-4" />
              New option grant
            </Link>
          </Button>
        ) : null
      }
    >
      {equityPlanContractTemplates.length === 0 || boardConsentTemplates.length === 0 ? (
        <Alert>
          <InformationCircleIcon />
          <AlertDescription>
            <Link href="/documents" className={linkClasses}>
              Create equity plan contract and board consent templates
            </Link>{" "}
            before adding new option grants.
          </AlertDescription>
        </Alert>
      ) : null}
      {data.length > 0 ? (
        <>
          <Figures
            items={[
              totalGrantedShares ? { caption: "Granted", value: totalGrantedShares.toLocaleString() } : null,
              totals.vestedShares ? { caption: "Vested", value: totals.vestedShares.toLocaleString() } : null,
              totals.unvestedShares ? { caption: "Left to vest", value: totals.unvestedShares.toLocaleString() } : null,
            ].filter((item) => !!item)}
          />

          <DataTable table={table} onRowClicked={(row) => router.push(`/people/${row.user.id}`)} />
          <DataTable table={optionHolderCountriesTable} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>There are no option grants right now.</Placeholder>
      )}
    </EquityLayout>
  );
};

const pluralizeGrants = (number: number) => `${number} ${pluralize("stock option grant", number)}`;

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

const InvestorGrantList = () => {
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.list.useSuspenseQuery(useInvestorQueryParams());
  const [selectedEquityGrant, setSelectedEquityGrant] = useState<EquityGrant | null>(null);
  const [exercisableGrants, setExercisableGrants] = useState<EquityGrant[]>([]);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  const totalShares = data.reduce((acc, grant) => acc + grant.numberOfShares, 0);
  const equityValueUsd = data.reduce((acc, grant) => acc.add(grant.vestedAmountUsd), new Decimal(0));
  const equityValueLabel = `Vested equity value ($${(company.valuationInDollars ?? 0).toLocaleString([], { notation: "compact" })} valuation)`;

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
    <EquityLayout>
      {data.length === 0 ? (
        <Placeholder icon={CheckCircleIcon}>You don't have any option grants right now.</Placeholder>
      ) : (
        <>
          <Figures
            items={[
              { caption: "Total shares owned", value: totalShares.toLocaleString() },
              { caption: "Share value", value: formatMoney(company.sharePriceInUsd ?? 0) },
              { caption: equityValueLabel, value: formatMoney(equityValueUsd, { precise: true }) },
            ]}
          />

          {company.flags.includes("option_exercising") && (
            <>
              {totalUnexercisedVestedShares > 0 && !exerciseInProgress && (
                <Alert className="mb-4 w-full">
                  <InformationCircleIcon />
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
                <Alert className="mb-4 w-full">
                  <InformationCircleIcon />
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
          )}

          <DataTable table={table} caption={pluralizeGrants(data.length)} onRowClicked={setSelectedEquityGrant} />

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
            <ExerciseModal
              equityGrants={exercisableGrants}
              companySharePrice={company.sharePriceInUsd ?? "0"}
              companyValuation={company.valuationInDollars || 0}
              onClose={() => setShowExerciseModal(false)}
            />
          ) : null}
        </>
      )}
    </EquityLayout>
  );
};
