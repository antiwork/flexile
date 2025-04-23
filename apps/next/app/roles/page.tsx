"use client";
import { BriefcaseIcon, LinkIcon } from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PayRateType } from "@/db/enums";
import { useCurrentCompany } from "@/global";
import { type RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { toSlug } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import ManageModal from "./ManageModal";

type Role = RouterOutput["roles"]["list"][number];

export default function RolesPage() {
  const company = useCurrentCompany();
  const companySlug = toSlug(company.name ?? "");

  const [roles, { refetch }] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });

  const [editingRole, setEditingRole] = useState<{ id: string | null } | null>(null);

  const getRolesUrl = () => new URL(`roles/${companySlug}-${company.id}`, window.location.origin).toString();
  const getRoleUrl = (roleSlug: string, roleId: string) =>
    new URL(`roles/${companySlug}/${roleSlug}-${roleId}`, window.location.origin).toString();

  const updateMutation = trpc.roles.update.useMutation({
    onSuccess: () => refetch(),
  });

  const columnHelper = createColumnHelper<Role>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Role",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("payRateInSubunits", {
        header: "Rate",
        cell: (info) => {
          const type = info.row.original.payRateType;
          return `${formatMoneyFromCents(info.getValue())}${
            type === PayRateType.Hourly ? " / hr" : type === PayRateType.Salary ? " / year" : ""
          }`;
        },
      }),
      columnHelper.accessor("applicationCount", {
        header: "Candidates",
        cell: (info) => (
          <a href={`/roles/${info.row.original.id}/applications`}>
            {`${info.getValue()} candidate${info.getValue() === 1 ? "" : "s"}`}
          </a>
        ),
      }),
      columnHelper.accessor("activelyHiring", {
        header: "Status",
        cell: (info) => {
          const role = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={role.activelyHiring}
                onCheckedChange={() =>
                  updateMutation.mutate({ companyId: company.id, id: role.id, activelyHiring: !role.activelyHiring })
                }
                label={role.activelyHiring ? "Hiring" : "Not hiring"}
              />
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CopyButton
              size="small"
              variant="outline"
              copyText={getRoleUrl(toSlug(info.row.original.name), info.row.original.id)}
            >
              <LinkIcon className="size-4" />
              Copy link
            </CopyButton>
            <Button size="small" variant="outline" onClick={() => setEditingRole(info.row.original)}>
              Edit
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useTable({
    columns,
    data: roles,
  });

  return (
    <MainLayout
      title="Roles"
      headerActions={
        <>
          <CopyButton variant="outline" copyText={getRolesUrl()}>
            <LinkIcon className="size-4" /> Copy public link
          </CopyButton>
          <Button onClick={() => setEditingRole({ id: null })}>New role</Button>
        </>
      }
    >
      {roles.length ? (
        <DataTable table={table} />
      ) : (
        <div>
          <Placeholder icon={BriefcaseIcon}>
            Create a role to publish job listings and hire contractors.
            <Button size="small" onClick={() => setEditingRole({ id: null })}>
              Create role
            </Button>
          </Placeholder>
        </div>
      )}

      {editingRole ? <ManageModal open onClose={() => setEditingRole(null)} id={editingRole.id} /> : null}
    </MainLayout>
  );
}
