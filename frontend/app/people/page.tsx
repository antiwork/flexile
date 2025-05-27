"use client";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import Link from "next/link";
import React, { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/app/components/main-layout";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { countries } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import { UserPlus, Users } from "lucide-react";

export default function PeoplePage() {
  const company = useCurrentCompany();
  const [workers] = trpc.contractors.list.useSuspenseQuery({ companyId: company.id });

  const columnHelper = createColumnHelper<(typeof workers)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("user.name", {
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "N/A",
        meta: { filterOptions: [...new Set(workers.map((worker) => worker.role))] },
      }),
      columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
      columnHelper.accessor((row) => (row.endedAt ? "Alumni" : row.startedAt > new Date() ? "Onboarding" : "Active"), {
        header: "Status",
        meta: { filterOptions: ["Active", "Onboarding", "Alumni"] },
        cell: (info) =>
          info.row.original.endedAt ? (
            <Status variant="critical">Ended on {formatDate(info.row.original.endedAt)}</Status>
          ) : info.row.original.startedAt <= new Date() ? (
            <Status variant="success">Started on {formatDate(info.row.original.startedAt)}</Status>
          ) : info.row.original.user.onboardingCompleted ? (
            <Status variant="success">Starts on {formatDate(info.row.original.startedAt)}</Status>
          ) : info.row.original.user.invitationAcceptedAt ? (
            <Status variant="primary">In Progress</Status>
          ) : (
            <Status variant="primary">Invited</Status>
          ),
      }),
    ],
    [],
  );

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "Status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <MainLayout
      title="People"
      headerActions={
        workers.length === 0 ? (
          <Button asChild size="small" variant="outline">
            <Link href="/people/new">
              <UserPlus className="size-4" />
              Invite contractor
            </Link>
          </Button>
        ) : null
      }
    >
      {workers.length > 0 ? (
        <DataTable
          table={table}
          searchColumn="user_name"
          actions={
            <Button asChild size="small" variant="outline">
              <Link href="/people/new">
                <UserPlus className="size-4" />
                Invite contractor
              </Link>
            </Button>
          }
        />
      ) : (
        <Placeholder icon={Users}>Contractors will show up here.</Placeholder>
      )}
    </MainLayout>
  );
}
