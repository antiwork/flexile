"use client";

import { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";

export default function AdminsPage() {
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const { data: users = [], isLoading } = trpc.companies.listUsersWithRoles.useQuery({ companyId: company.id });

  const trpcUtils = trpc.useUtils();

  const toggleAdminMutation = trpc.companies.toggleAdminRole.useMutation({
    onMutate: async ({ userId, isAdmin }) => {
      // Optimistic update
      await trpcUtils.companies.listUsersWithRoles.cancel({ companyId: company.id });
      const previousUsers = trpcUtils.companies.listUsersWithRoles.getData({ companyId: company.id });

      trpcUtils.companies.listUsersWithRoles.setData({ companyId: company.id }, (old) => {
        if (!old) return old;
        return old.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              isAdmin,
              role: isAdmin ? "Admin" : null,
            };
          }
          return user;
        });
      });

      return { previousUsers };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousUsers) {
        trpcUtils.companies.listUsersWithRoles.setData({ companyId: company.id }, context.previousUsers);
      }
    },
    onSettled: async () => {
      await trpcUtils.companies.listUsersWithRoles.invalidate();
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
        id: "active",
        header: "Active",
        cell: (info) => {
          const user = info.row.original;
          const isCurrentUserRow = currentUser.email === user.email;
          const isLoadingToggle = toggleAdminMutation.isPending && toggleAdminMutation.variables.userId === user.id;

          return (
            <Switch
              checked={user.isAdmin}
              onCheckedChange={(checked) => {
                if (isCurrentUserRow) return;
                toggleAdminMutation.mutate({
                  companyId: company.id,
                  userId: user.id,
                  isAdmin: checked,
                });
              }}
              disabled={isCurrentUserRow || isLoadingToggle}
              aria-label={`Toggle admin status for ${user.name || user.email}`}
              className={cn(
                isCurrentUserRow && "cursor-not-allowed opacity-50",
                isLoadingToggle && "pointer-events-none opacity-70",
              )}
            />
          );
        },
      }),
    ],
    [currentUser.email, company.id, toggleAdminMutation],
  );

  const table = useTable({
    columns,
    data: users,
  });

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-xl font-bold">Admins</h2>
        <p className="text-muted-foreground text-base">Manage access for users with admin roles in your workspace.</p>
      </hgroup>
      {/* override default padding to align table content with page header */}
      <div className="[&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
        {isLoading ? <TableSkeleton columns={3} /> : <DataTable table={table} />}
      </div>
    </div>
  );
}
