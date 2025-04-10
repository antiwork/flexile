"use client";
import { UserIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import Tabs from "@/components/Tabs";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { PayRateType, trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

const columnHelper = createColumnHelper<RouterOutput["contractorProfiles"]["list"][number]>();
const columns = [
  columnHelper.accessor("preferredName", {
    header: "Name",
    cell: (info) => (
      <Link href={`/talent_pool/${info.row.original.id}`} className="no-underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.simple("role", "Role"),
  columnHelper.accessor((row) => row.payRateInSubunits, {
    id: "rate",
    header: "Rate",
    cell: (info) =>
      `${formatMoneyFromCents(info.getValue())} / ${info.row.original.payRateType === PayRateType.Hourly ? "hour" : "project"}`,
  }),
  columnHelper.simple(
    "availableHoursPerWeek",
    "Availability",
    (value) => `${value} ${value === 1 ? "hour" : "hours"} / week`,
  ),
  columnHelper.simple("countryCode", "Country", (v) => countries.get(v ?? "") ?? v),
];

export default function TalentPool() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [contractorProfiles] = trpc.contractorProfiles.list.useSuspenseQuery({ excludeCompanyId: company.id });

  const table = useTable({
    columns,
    data: contractorProfiles,
  });

  return (
    <MainLayout title="Talent pool">
      <Tabs
        links={[
          { label: "Roles", route: "/roles" },
          { label: "Talent pool", route: "/talent_pool" },
        ]}
      />
      {contractorProfiles.length ? (
        <Table table={table} onRowClicked={(row) => router.push(`/talent_pool/${row.id}`)} />
      ) : (
        <Placeholder icon={UserIcon}>No contractor profiles available.</Placeholder>
      )}
    </MainLayout>
  );
}
