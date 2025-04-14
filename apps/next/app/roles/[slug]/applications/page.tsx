"use client";
import { CircleCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useMemo } from "react";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { useCurrentCompany } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

export default function RoleApplicationsPage() {
  const router = useRouter();
  const company = useCurrentCompany();
  const { slug: id } = useParams<{ slug: string }>();

  const [role] = trpc.roles.get.useSuspenseQuery({
    companyId: company.id,
    id,
  });
  const [applications] = trpc.roles.applications.list.useSuspenseQuery({
    companyId: company.id,
    roleId: role.id,
  });

  type Application = (typeof applications)[number];
  const rowLink = (row: Application) => `/role_applications/${row.id}` as const;
  const columnHelper = createColumnHelper<Application>();

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("name", {
          header: "Name",
          cell: (info) => (
            <a href={rowLink(info.row.original)} className="no-underline">
              {info.getValue()}
            </a>
          ),
        }),
        columnHelper.simple("createdAt", "Application date", formatDate),
        role.payRateType === PayRateType.Hourly
          ? columnHelper.simple("hoursPerWeek", "Availability", (v) => `${v}h / week`)
          : null,
      ].filter((column) => !!column),
    [role],
  );

  const table = useTable({
    data: applications,
    columns,
  });

  return (
    <MainLayout title={role.name}>
      {applications.length ? (
        <Table table={table} onRowClicked={(row) => router.push(rowLink(row))} />
      ) : (
        <div>
          <Placeholder icon={CircleCheck}>No candidates to review.</Placeholder>
        </div>
      )}
    </MainLayout>
  );
}
