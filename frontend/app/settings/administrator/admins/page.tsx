"use client";

import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

export default function AdminsPage() {
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const { data: users = [], isLoading } = trpc.companies.listAdministrators.useQuery({ companyId: company.id });
  const [confirmRevokeUser, setConfirmRevokeUser] = useState<(typeof users)[number] | null>(null);

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
        header: "",
        cell: (info) => {
          const user = info.row.original;

          // Don't show any action button for owners
          if (user.role === "Owner") {
            return null;
          }

          const isCurrentUserRow = currentUser.email === user.email;
          const isLoadingRevoke = revokeAdminMutation.isPending && revokeAdminMutation.variables.userId === user.id;
          const adminCount = users.filter((u) => u.isAdmin).length;
          const isLastAdmin = adminCount === 1 && user.isAdmin;

          return (
            <div className="text-left">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="small"
                    className="h-8 w-8 p-0"
                    disabled={isCurrentUserRow || isLoadingRevoke || isLastAdmin}
                  >
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="focus:text-destructive hover:text-destructive"
                    onClick={() => setConfirmRevokeUser(user)}
                  >
                    Remove admin
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
    <>
      <div className="grid gap-8">
        <hgroup>
          <h2 className="mb-1 text-3xl font-bold">Workspace admins</h2>
          <p className="text-muted-foreground text-base">Manage access for users with admin roles in your workspace.</p>
        </hgroup>
        {/* override default padding to align table content with page header */}
        <div className="[&_td:first-child]:!pl-0 [&_td:last-child]:!pr-0 [&_th:first-child]:!pl-0 [&_th:last-child]:!pr-0">
          {isLoading ? <TableSkeleton columns={3} /> : <DataTable table={table} />}
        </div>
      </div>

      <AlertDialog open={!!confirmRevokeUser} onOpenChange={() => setConfirmRevokeUser(null)}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove admin access for{" "}
              <span className="font-medium">{confirmRevokeUser?.name || confirmRevokeUser?.email}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke their admin privileges. They'll still be a member of the workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="critical"
                onClick={() => {
                  if (confirmRevokeUser) {
                    revokeAdminMutation.mutate({
                      companyId: company.id,
                      userId: confirmRevokeUser.id,
                    });
                    setConfirmRevokeUser(null);
                  }
                }}
              >
                Remove admin
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
