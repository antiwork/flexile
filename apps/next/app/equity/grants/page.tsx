"use client";
import { PencilIcon } from "@heroicons/react/16/solid";
import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Figures from "@/components/Figures";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DocumentTemplateType } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type EquityGrant = RouterOutput["equityGrants"]["list"][number];
type OptionHolderCountry = RouterOutput["equityGrants"]["byCountry"][number];

const countryColumnHelper = createColumnHelper<OptionHolderCountry>();
const countryColumns = [
  countryColumnHelper.simple("countryCode", "Country", (v) => countries.get(v ?? "") ?? v),
  countryColumnHelper.simple("optionHolders", "Number of option holders", (v) => v.toLocaleString(), "numeric"),
];

const columnHelper = createColumnHelper<EquityGrant>();
const columns = [
  columnHelper.accessor("optionHolderName", {
    header: "Contractor",
    cell: (info) => (
      <Link href={`/people/${info.row.original.user.id}`} className="no-underline">
        {info.row.original.optionHolderName}
      </Link>
    ),
  }),
  columnHelper.simple("issuedAt", "Issue date", formatDate),
  columnHelper.simple("numberOfShares", "Granted", (v) => v.toLocaleString(), "numeric"),
  columnHelper.simple("vestedShares", "Vested", (v) => v.toLocaleString(), "numeric"),
  columnHelper.simple("unvestedShares", "Unvested", (v) => v.toLocaleString(), "numeric"),
  columnHelper.simple("exercisedShares", "Exercised", (v) => v.toLocaleString(), "numeric"),
  columnHelper.simple("exercisePriceUsd", "Exercise price", (v) => formatMoney(v, { precise: true }), "numeric"),
];

export default function GrantsPage() {
  const router = useRouter();
  const company = useCurrentCompany();
  const [data] = trpc.equityGrants.list.useSuspenseQuery({ companyId: company.id });
  const [totals] = trpc.equityGrants.totals.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns, data });
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
}
