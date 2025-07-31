"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "lawyer"]),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

export default function RolesPage() {
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: string; name: string; role: string } | null>(null);

  const { data: admins = [] } = trpc.companies.listAdministrators.useQuery({ companyId: company.id });
  const { data: lawyers = [] } = trpc.companies.listLawyers.useQuery({ companyId: company.id });
  const { data: companyUsers = [] } = trpc.companies.listCompanyUsers.useQuery({ companyId: company.id });

  const trpcUtils = trpc.useUtils();

  const addRoleMutation = trpc.companies.addRole.useMutation({
    onSuccess: async () => {
      await trpcUtils.companies.listAdministrators.invalidate();
      await trpcUtils.companies.listLawyers.invalidate();
      setShowAddModal(false);
      addMemberForm.reset();
    },
  });

  const removeRoleMutation = trpc.companies.removeRole.useMutation({
    onSuccess: async () => {
      await trpcUtils.companies.listAdministrators.invalidate();
      await trpcUtils.companies.listLawyers.invalidate();
      setConfirmRevoke(null);
    },
  });

  const addMemberForm = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { userId: "", role: "admin" },
  });

  const allRoles = useMemo(() => {
    const byId: Record<
      string,
      { id: string; name: string; email: string; role: string; isAdmin: boolean; isOwner: boolean }
    > = {};
    admins.forEach((a) => {
      byId[a.id] = { ...a };
    });
    lawyers.forEach((l) => {
      const existing = byId[l.id];
      if (existing) {
        if (existing.role === "Owner") return;
        existing.role = existing.isAdmin ? "Admin" : "Lawyer";
      } else {
        byId[l.id] = { ...l };
      }
    });
    return Object.values(byId);
  }, [admins, lawyers]);

  const columnHelper = createColumnHelper<(typeof allRoles)[number]>();
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
          if (user.role === "Owner") return null;
          const isCurrentUserRow = currentUser.email === user.email;
          const isLoadingRevoke = removeRoleMutation.isPending && removeRoleMutation.variables.userId === user.id;
          const adminCount = allRoles.filter((u) => u.isAdmin).length;
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
                  {user.isAdmin ? (
                    <DropdownMenuItem
                      className="focus:text-destructive hover:text-destructive"
                      onClick={() => setConfirmRevoke({ id: user.id, name: user.name, role: "admin" })}
                    >
                      Remove admin
                    </DropdownMenuItem>
                  ) : null}
                  {user.role.includes("Lawyer") && (
                    <DropdownMenuItem
                      className="focus:text-destructive hover:text-destructive"
                      onClick={() => setConfirmRevoke({ id: user.id, name: user.name, role: "lawyer" })}
                    >
                      Remove lawyer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [currentUser.email, allRoles, removeRoleMutation],
  );

  const table = useTable({
    columns,
    data: allRoles,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleSubmit = (values: AddMemberForm) => {
    addRoleMutation.mutate({
      companyId: company.id,
      userId: values.userId,
      role: values.role,
    });
  };

  const handleRemoveRole = () => {
    if (confirmRevoke) {
      removeRoleMutation.mutate({
        companyId: company.id,
        userId: confirmRevoke.id,
        role: confirmRevoke.role === "admin" ? "admin" : "lawyer",
      });
    }
  };

  return (
    <>
      <div className="grid gap-8">
        <hgroup>
          <h2 className="mb-1 text-xl font-bold">Roles</h2>
          <p className="text-muted-foreground text-base">Use roles to grant deeper access to your workspace.</p>
        </hgroup>
        <div className="[&_td:first-child]:!pl-0 [&_td:last-child]:!pr-0 [&_th:first-child]:!pl-0 [&_th:last-child]:!pr-0">
          {admins.length === 0 && lawyers.length === 0 ? (
            <TableSkeleton columns={3} />
          ) : (
            <DataTable
              table={table}
              searchColumn="name"
              actions={
                <Button variant="outline" size="small" onClick={() => setShowAddModal(true)}>
                  <Plus className="mr-2 size-4" />
                  Add member
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>
              Pick someone from your workspace and choose the role that fits the work they'll be doing.
            </DialogDescription>
          </DialogHeader>
          <Form {...addMemberForm}>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void addMemberForm.handleSubmit(handleSubmit)(e);
              }}
            >
              <FormField
                control={addMemberForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select member</FormLabel>
                    <FormControl>
                      <ComboBox
                        {...field}
                        options={companyUsers.map((u) => ({
                          value: u.id,
                          label: `${u.name} (${u.email})`,
                        }))}
                        placeholder="Search by name..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addMemberForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select className="rounded border px-2 py-1" {...field}>
                        <option value="admin">Admin</option>
                        <option value="lawyer">Lawyer</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={!addMemberForm.formState.isValid || addRoleMutation.isPending}>
                  Add member
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRevoke} onOpenChange={() => setConfirmRevoke(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Remove {confirmRevoke?.role === "admin" ? "admin" : "lawyer"} access for{" "}
              <span className="font-medium">{confirmRevoke?.name}</span>?
            </DialogTitle>
            <DialogDescription>
              This will revoke their {confirmRevoke?.role === "admin" ? "admin" : "lawyer"} privileges. They'll still be
              a member of the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button variant="critical" onClick={handleRemoveRole} disabled={removeRoleMutation.isPending}>
              Remove {confirmRevoke?.role === "admin" ? "admin" : "lawyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
