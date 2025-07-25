"use client";
import { CircleCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useMemo } from "react";
import CopyButton from "@/components/CopyButton";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCurrentCompany, useCurrentUser } from "@/global";
import {
  fetchInvestorEmail,
  fetchInvestorId,
  fetchInvestorUserId,
  isInvestor,
  isInvestorForAdmin,
} from "@/models/investor";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatOwnershipPercentage } from "@/utils/numbers";

type Data = RouterOutput["capTable"]["show"];

export default function CapTable() {
  const company = useCurrentCompany();
  const searchParams = useSearchParams();
  const newSchema = searchParams.get("new_schema") !== null;
  const {
    data = { investors: [], shareClasses: [], optionPools: [], outstandingShares: "", fullyDilutedShares: "" },
    isLoading,
  } = trpc.capTable.show.useQuery({
    companyId: company.id,
    newSchema,
  });
  const user = useCurrentUser();
  const canViewInvestor = !!user.roles.administrator || !!user.roles.lawyer;

  type InvestorItem = Data["investors"][number];
  const investorColumnHelper = createColumnHelper<InvestorItem>();

  const investorRowLink = (investor: InvestorItem) => {
    const selectedTab = isInvestor(investor) && investor.outstandingShares > 0 ? "shares" : "options";
    if (newSchema) {
      const id = fetchInvestorId(investor);
      if (id === null) return "#";
      return `/companies/${company.id}/investor_entities/${id}?tab=${selectedTab}`;
    }
    const userId = fetchInvestorUserId(investor);
    if (userId === null) return "#";
    return `/people/${userId}?tab=${selectedTab}`;
  };

  const investorsColumns = useMemo(
    () => [
      investorColumnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const investor = info.row.original;
          const contents = (
            <div className="flex flex-wrap gap-1">
              <strong>{info.getValue()}</strong>
              {isInvestorForAdmin(investor) && investor.email}
            </div>
          );
          return canViewInvestor && isInvestor(investor) ? (
            <a href={investorRowLink(investor)} className={linkClasses}>
              {contents}
            </a>
          ) : (
            contents
          );
        },
        footer: "Total",
      }),
      investorColumnHelper.accessor((row) => (isInvestor(row) ? row.outstandingShares : undefined), {
        header: "Outstanding shares",
        cell: (info) => info.getValue()?.toLocaleString() ?? "—",
        meta: { numeric: true },
      }),
      investorColumnHelper.accessor((row) => (isInvestor(row) ? row.outstandingShares : undefined), {
        header: "Outstanding ownership",
        cell: (info) => {
          const value = info.getValue();
          return value ? formatOwnershipPercentage(Number(value) / Number(data.outstandingShares)) : "—";
        },
        meta: { numeric: true },
      }),
      investorColumnHelper.accessor((row) => ("fullyDilutedShares" in row ? row.fullyDilutedShares : undefined), {
        header: "Fully diluted shares",
        cell: (info) => info.getValue()?.toLocaleString() ?? "—",
        meta: { numeric: true },
        footer: data.fullyDilutedShares.toLocaleString(),
      }),
      investorColumnHelper.accessor((row) => ("fullyDilutedShares" in row ? row.fullyDilutedShares : undefined), {
        header: "Fully diluted ownership",
        cell: (info) => {
          const value = info.getValue();
          return value ? formatOwnershipPercentage(Number(value) / Number(data.fullyDilutedShares)) : "—";
        },
        meta: { numeric: true },
        footer: "100%",
      }),

      investorColumnHelper.simple("notes", "Notes"),
    ],
    [],
  );

  const investorsData = useMemo(
    () => [
      ...data.investors,
      ...data.optionPools.map((pool) => ({
        name: `Options available (${pool.name})`,
        fullyDilutedShares: pool.availableShares,
      })),
    ],
    [data.investors, data.optionPools],
  );

  const investorsTable = useTable({
    data: investorsData,
    columns: investorsColumns,
    enableRowSelection: canViewInvestor ? (row) => isInvestor(row.original) : false,
  });

  const selectedInvestors = investorsTable.getSelectedRowModel().rows.map((row) => row.original);
  const selectedInvestorEmails = selectedInvestors
    .map(fetchInvestorEmail)
    .filter((email): email is string => !!email)
    .join(", ");

  return (
    <>
      <DashboardHeader
        title={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>Equity</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Investors</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />

      {selectedInvestors.length > 0 && (
        <Alert className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{selectedInvestors.length}</strong> selected
            </span>
            <CopyButton copyText={selectedInvestorEmails}>Contact selected</CopyButton>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : data.investors.length > 0 ? (
        <div className="overflow-x-auto">
          <DataTable table={investorsTable} />
        </div>
      ) : (
        <Placeholder icon={CircleCheck}>There are no active investors right now.</Placeholder>
      )}
    </>
  );
}
