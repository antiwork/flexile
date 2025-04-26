"use client";
import { UserPlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import React, { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

type Contractor = RouterOutput["contractors"]["list"]["workers"][number];

export default function PeoplePage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [type] = useQueryState(
    "type",
    parseAsStringLiteral(["onboarding", "alumni", "active"] as const).withDefault("active"),
  );
  const [{ workers }] = trpc.contractors.list.useSuspenseQuery({ companyId: company.id, type });

  const columnHelper = createColumnHelper<Contractor>();
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("user.name", {
          header: "Name",
          cell: (info) => {
            const content = info.getValue();
            return user.activeRole === "administrator" ? (
              <Link href={`/people/${info.row.original.user.id}`} className="after:absolute after:inset-0">
                {content}
              </Link>
            ) : (
              <div>{content}</div>
            );
          },
        }),
        columnHelper.accessor("role.name", {
          header: "Role",
          cell: (info) => info.getValue() || "N/A",
          meta: {
            filterOptions: [...new Set(workers.map((worker) => worker.role.name))],
          },
        }),
        columnHelper.accessor("user.countryCode", {
          header: "Country",
          cell: (info) => {
            const countryCode = info.getValue();
            return countryCode ? countries.get(countryCode) : "";
          },
          meta: {
            filterOptions: [
              ...new Set(
                workers
                  .map((worker) => worker.user.countryCode)
                  .filter(Boolean)
                  .map((code) => (typeof code === "string" ? countries.get(code) || "" : "")),
              ),
            ],
          },
        }),
        columnHelper.accessor("startedAt", {
          header: "Start date",
          cell: (info) => formatDate(info.getValue()),
          meta: {
            filterOptions: [...new Set(workers.map((worker) => new Date(worker.startedAt).getFullYear().toString()))],
          },
          filterFn: (row, _, filterValue) =>
            Array.isArray(filterValue) &&
            filterValue.includes(new Date(row.original.startedAt).getFullYear().toString()),
        }),
        ...(type === "active" &&
        workers.some((person) => {
          const endDate = person.endedAt;
          return endDate && new Date(endDate) > new Date();
        })
          ? [
              columnHelper.accessor(
                (row) => {
                  const endDate = row.endedAt;
                  return endDate ? new Date(endDate) : null;
                },
                {
                  id: "endedAt",
                  header: "End date",
                  cell: (info) => {
                    const value = info.getValue();
                    return value ? formatDate(value) : "";
                  },
                },
              ),
            ]
          : []),
        columnHelper.accessor(
          (row) => {
            if (row.endedAt) return "Inactive";
            return row.onTrial ? "Trial" : "Active";
          },
          {
            id: "status",
            header: "Status",
            meta: {
              filterOptions: ["Active", "Trial", "Inactive"],
            },
            cell: (info) => {
              const status = info.getValue();
              return (
                <Status variant={status === "Active" ? "success" : status === "Trial" ? "primary" : "secondary"}>
                  {status}
                </Status>
              );
            },
          },
        ),
        columnHelper.accessor(
          (row) => {
            if (row.onTrial || new Date(row.startedAt) > new Date()) return "Onboarding";
            if (row.endedAt && new Date(row.endedAt) < new Date()) return "Alumni";
            return "Active";
          },
          {
            id: "type",
            header: "Type",
            meta: {
              filterOptions: ["Onboarding", "Active", "Alumni"],
            },
          },
        ),
      ].filter(Boolean),
    [type],
  );

  const table = useTable({
    columns,
    data: workers,
    initialState: {
      sorting: [{ id: "user.name", desc: false }],
      columnFilters: [
        {
          id: "type",
          value: [type === "onboarding" ? "Onboarding" : type === "alumni" ? "Alumni" : "Active"],
        },
      ],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <MainLayout
      title="People"
      headerActions={
        user.activeRole === "administrator" ? (
          <Button asChild>
            <Link href="/people/new">
              <UserPlusIcon className="size-4" />
              Invite contractor
            </Link>
          </Button>
        ) : null
      }
    >
      {workers.length > 0 ? (
        <DataTable
          table={table}
          searchColumn="user.name"
          onRowClicked={user.activeRole === "administrator" ? () => "" : undefined}
        />
      ) : (
        <Placeholder icon={UsersIcon}>Contractors will show up here.</Placeholder>
      )}
    </MainLayout>
  );
}
