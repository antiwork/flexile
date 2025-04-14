"use client";
import { UserPlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import React, { useMemo } from "react";
import MainLayout from "@/components/layouts/Main";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Tabs from "@/components/Tabs";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { countries } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

type Contractor = RouterOutput["contractors"]["list"]["workers"][number];

const perPage = 25;
export default function People() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [type] = useQueryState(
    "type",
    parseAsStringLiteral(["onboarding", "alumni", "active"] as const).withDefault("active"),
  );
  const [page] = usePage();
  const [data] = trpc.contractors.list.useSuspenseQuery({ companyId: company.id, type, perPage, page });

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
        columnHelper.simple("role.name", "Role", (value) => value || "N/A"),
        columnHelper.simple("user.countryCode", "Country", (v) => v && countries.get(v)),
        columnHelper.simple("startedAt", "Start Date", formatDate),
        ...(type === "active" &&
        data.workers.some((person) => {
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
                  header: "End Date",
                  cell: (info) => {
                    const value = info.getValue();
                    return value ? formatDate(value) : "";
                  },
                },
              ),
            ]
          : []),
        type === "onboarding"
          ? columnHelper.accessor("user.onboardingCompleted", {
              header: "Status",
              cell: (info) =>
                info.getValue() ? (
                  info.row.original.onTrial ? (
                    <Status variant="success">On trial</Status>
                  ) : (
                    <Status variant="success">Starts on {formatDate(info.row.original.startedAt)}</Status>
                  )
                ) : info.row.original.user.invitationAcceptedAt ? (
                  <Status variant="primary">In Progress</Status>
                ) : (
                  <Status variant="primary">Invited</Status>
                ),
            })
          : null,
      ].filter((column) => !!column),
    [type],
  );

  const table = useTable({ columns, data: data.workers });

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
      <Tabs
        links={[
          { label: "Onboarding", route: "?type=onboarding" },
          { label: "Active", route: "?" },
          { label: "Alumni", route: "?type=alumni" },
        ]}
      />

      {data.workers.length > 0 ? (
        <>
          <Table table={table} onRowClicked={user.activeRole === "administrator" ? () => "" : undefined} />
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={UsersIcon}>Contractors will show up here.</Placeholder>
      )}
    </MainLayout>
  );
}
