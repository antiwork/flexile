"use client";

import { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

export default function AdminsPage() {
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const { data: users = [], isLoading } = trpc.companies.listAdministrators.useQuery({ companyId: company.id });

  const trpcUtils = trpc.useUtils();

  const revokeAdminMutation = trpc.companies.revokeAdminRole.useMutation({
    onMutate: async ({ userId }) => {
      // Optimistic update - remove the user from the list
      await trpcUtils.companies.listAdministrators.cancel({ companyId: company.id });
      const previousUsers = trpcUtils.companies.listAdministrators.getData({ companyId: company.id });

      trpcUtils.companies.listAdministrators.setData({ companyId: company.id }, (old) => {
        if (!old) return old;
        return old.filter((user) => user.id !== userId);
      });

      return { previousUsers };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousUsers) {
        trpcUtils.companies.listAdministrators.setData({ companyId: company.id }, context.previousUsers);
      }
    },
    onSettled: async () => {
      await trpcUtils.companies.listAdministrators.invalidate();
    },
  });

  const columnHelper = createColumnHelper<(typeof users)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const user = info.row.original;
          const isCurrentUser = currentUser.email === user.email;
          return (
            <div>
              <div className="font-medium">
                {user.name}
                {isCurrentUser ? <span className="text-muted-foreground ml-1">(You)</span> : null}
              </div>
              <div className="text-muted-foreground text-sm">{user.email}</div>
            </div>
          );
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => info.getValue() || "-",
      }),
      columnHelper.display({
        id: "actions",
        header: "Action",
        cell: (info) => {
          const user = info.row.original;
          const isCurrentUserRow = currentUser.email === user.email;
          const isLoadingRevoke = revokeAdminMutation.isPending && revokeAdminMutation.variables?.userId === user.id;
          const adminCount = users.filter((u) => u.isAdmin).length;
          const isLastAdmin = adminCount === 1 && user.isAdmin;

          return (
            <div className="text-left">
              <Button
                variant="destructive"
                size="small"
                onClick={() => {
                  revokeAdminMutation.mutate({
                    companyId: company.id,
                    userId: user.id,
                  });
                }}
                disabled={isCurrentUserRow || isLoadingRevoke || isLastAdmin}
                aria-label={`Revoke admin access for ${user.name || user.email}`}
              >
                Remove admin status
              </Button>
            </div>
          );
        },
      }),
    ],
    [currentUser.email, company.id, revokeAdminMutation, users],
  );

  const table = useTable({
    columns,
    data: users,
  });

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-xl font-bold">Workspace Administrators</h2>
        <p className="text-muted-foreground text-base">View and revoke administrator access for your workspace.</p>
      </hgroup>
      {/* override default padding to align table content with page header */}
      <div className="[&_td:first-child]:!pl-0 [&_td:last-child]:!pr-0 [&_th:first-child]:!pl-0 [&_th:last-child]:!pr-0">
        {isLoading ? <TableSkeleton columns={3} /> : <DataTable table={table} />}
      </div>
    </div>
  );
}
