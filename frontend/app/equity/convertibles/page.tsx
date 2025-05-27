"use client";
import { CircleCheck } from "lucide-react";
import React from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../layout";

const columnHelper =
  createColumnHelper<RouterOutput["convertibleSecurities"]["list"]["convertibleSecurities"][number]>();
const columns = [
  columnHelper.simple("issuedAt", "Issue date", formatDate),
  columnHelper.simple("convertibleType", "Type"),
  columnHelper.simple("companyValuationInDollars", "Pre-money valuation cap", (value) => formatMoney(value), "numeric"),
  columnHelper.simple("principalValueInCents", "Investment amount", (value) => formatMoneyFromCents(value), "numeric"),
];

export default function Convertibles() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.convertibleSecurities.list.useSuspenseQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id ?? "",
  });

  const table = useTable({ columns, data: data.convertibleSecurities });

  return (
    <EquityLayout>
      {data.convertibleSecurities.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <Placeholder icon={CircleCheck}>You do not hold any convertible securities.</Placeholder>
      )}
    </EquityLayout>
  );
}
