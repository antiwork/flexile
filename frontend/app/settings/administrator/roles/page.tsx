"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getFilteredRowModel } from "@tanstack/react-table";
import { MoreHorizontal, Plus, Scale, SendHorizontal, ShieldUser, Trash2 } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import z from "zod";
import ComboBox from "@/components/ComboBox";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { MutationStatusButton } from "@/components/MutationButton";
import TableSkeleton from "@/components/TableSkeleton";
import { Badge } from "@/components/ui/badge";
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
import { trpc, workspaceMemberRoles } from "@/trpc/client";
import UnprivilegedUserComboBox from "./UnprivilegedUserComboBox";

const ROLES_WHITELIST = z.enum([workspaceMemberRoles[1], workspaceMemberRoles[2]], {
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return { message: "Please select a valid role" };
    }
    return { message: ctx.defaultError };
  },
});

const addWorkspaceMemberSchema = z.object({
  user: z.object({
    id: z.string().or(z.undefined()),
    name: z.string(),
    email: z.string().min(1, "Please select a valid user").email("Please enter a valid email address"),
    isContractor: z.boolean(),
    isInvestor: z.boolean(),
  }),
  role: ROLES_WHITELIST,
});

const WORKSPACE_ROLE_OPTIONS = workspaceMemberRoles
  .filter((role) => role === workspaceMemberRoles[1] || role === workspaceMemberRoles[2])
  .map((role) => ({
    value: role,
    label: role,
  }));

type WorkspaceMemberAdditionForm = z.infer<typeof addWorkspaceMemberSchema>;

export default function RolePage() {
  // 1. State Management
  const trpcUtils = trpc.useUtils();
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [confirmRevokeUser, setConfirmRevokeUser] = useState<(typeof users)[number] | null>(null);
  const { data: users = [], isLoading } = trpc.companies.usersWithRole.useQuery({ companyId: company.id });
  const { data: usersWithoutRoles = [] } = trpc.companies.usersWithoutRole.useQuery(
    {
      companyId: company.id,
      userId: currentUser.id,
      // Pass the IDs of users who already have roles
      excludeRoledUserIds: users.map((user) => user.id),
    },
    {
      enabled: showAddMemberModal,
    },
  );

  const roledMembersEmailList = useRef<Set<string>>(new Set());

  roledMembersEmailList.current = new Set(users.map((member) => member.email));

  // 2. Form
  const addMemberForm = useForm<WorkspaceMemberAdditionForm>({
    resolver: zodResolver(
      addWorkspaceMemberSchema.superRefine((data, ctx) => {
        if (roledMembersEmailList.current.has(data.user.email)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cannot invite members with a role assigned",
            path: ["user"],
          });
        }

        try {
          z.string().email().parse(data.user.email);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter a valid email address",
            path: ["user"],
          });
        }
      }),
    ),
    defaultValues: {
      role: "Lawyer",
    },
  });

  const inviteUserToWorkspace = !useWatch({
    control: addMemberForm.control,
    name: "user.id",
  });

  // 3. Mutations
  const inviteUserToWorkspaceMutation = trpc.companies.inviteUserToWorkspace.useMutation({
    onMutate: () => {
      void trpcUtils.companies.usersWithRole.cancel({ companyId: company.id });
    },
    onSuccess: () => {
      void trpcUtils.companies.usersWithRole.invalidate();

      addMemberForm.reset({
        role: "Lawyer",
      });
      setShowAddMemberModal(false);
    },
    onError: (error) => {
      addMemberForm.clearErrors();
      addMemberForm.setError("user", { message: error.message });
    },
  });

  const changeRoleMutation = trpc.companies.updateWorkspaceMemberRole.useMutation({
    onMutate: () => {
      void trpcUtils.companies.usersWithRole.cancel({ companyId: company.id });
    },
    onSettled: async (_data, _error, variables) => {
      await trpcUtils.companies.usersWithRole.invalidate();
      if (variables.fromAddMemberForm) {
        addMemberForm.reset({
          role: "Lawyer",
        });
        setShowAddMemberModal(false);
      }
    },
    onError: (error, input) => {
      if (input.fromAddMemberForm) {
        addMemberForm.clearErrors();
        addMemberForm.setError("user", { message: error.message });
      }
    },
  });

  const revokeRoleMutation = trpc.companies.deleteWorkspaceMemberRole.useMutation({
    onMutate: async () => {
      await trpcUtils.companies.usersWithRole.cancel({ companyId: company.id });
    },
    onSettled: async () => {
      await trpcUtils.companies.usersWithRole.invalidate();
    },
  });

  // Switch based on selected option
  // For existing user, change role
  // For new user, invite flow
  const addMemberFormSubmit = useCallback(
    addMemberForm.handleSubmit(async ({ user, role }) => {
      addMemberForm.clearErrors();
      if (user.id) {
        return changeRoleMutation.mutateAsync({
          companyId: company.id,
          userId: user.id,
          role,
          fromAddMemberForm: true,
        });
      }
      return inviteUserToWorkspaceMutation.mutateAsync({ companyId: company.id, email: user.email, role });
    }),
    [addMemberForm, inviteUserToWorkspaceMutation, changeRoleMutation, company.id],
  );

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
              <div className="text-muted-foreground text-xs">{user.email}</div>
            </div>
          );
        },
        filterFn: (row, _, filterValue: string) => {
          const searchableRowContent = `${row.original.name} ${row.original.email}`;
          return searchableRowContent.toLowerCase().includes(filterValue.toLowerCase());
        },
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => {
          const user = info.row.original;
          const role = info.getValue();
          const isLoading = changeRoleMutation.isPending && changeRoleMutation.variables.userId === user.id;

          let variant: "default" | "secondary" | "outline" = "secondary";
          if (role === "Owner") variant = "default";
          else if (role === "Admin") variant = "outline";
          else if (role === "Lawyer") variant = "secondary";

          return (
            <div className="inline-flex md:w-22">
              {isLoading ? "Switching..." : <Badge variant={variant}>{role}</Badge>}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const user = info.row.original;
          const role = user.role;
          const owner = role === workspaceMemberRoles[0];
          const admin = role === workspaceMemberRoles[1];
          const lawyer = role === workspaceMemberRoles[2];
          const member = role === workspaceMemberRoles[3];

          if (owner) {
            return null;
          }

          const isCurrentUserRow = currentUser.email === user.email;
          const isLoadingRevoke = revokeRoleMutation.isPending && revokeRoleMutation.variables.userId === user.id;
          const isLoadingChangeRole = changeRoleMutation.isPending && changeRoleMutation.variables.userId === user.id;
          const adminCount = users.filter((u) => u.isAdmin).length;
          const isLastAdmin = adminCount === 1 && user.isAdmin;

          return (
            <div className="text-left">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="small"
                    className="size-8 p-0"
                    disabled={isCurrentUserRow || isLoadingRevoke || isLoadingChangeRole || isLastAdmin}
                  >
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(admin || member) && !lawyer ? (
                    <DropdownMenuItem
                      onClick={() =>
                        changeRoleMutation.mutate({
                          companyId: company.id,
                          userId: user.id,
                          role: "Lawyer",
                        })
                      }
                    >
                      <Scale className="size-4" />
                      Make Lawyer
                    </DropdownMenuItem>
                  ) : null}
                  {(lawyer || member) && !admin ? (
                    <DropdownMenuItem
                      onClick={() =>
                        changeRoleMutation.mutate({
                          companyId: company.id,
                          userId: user.id,
                          role: "Admin",
                        })
                      }
                    >
                      <ShieldUser className="size-4" />
                      Make Admin
                    </DropdownMenuItem>
                  ) : null}
                  {admin || lawyer ? (
                    <DropdownMenuItem
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmRevokeUser(user)}
                    >
                      <Trash2 className="text-destructive size-4" />
                      Revoke Role
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [currentUser.email, company.id, revokeRoleMutation, changeRoleMutation, users],
  );

  const table = useTable({
    columns,
    getRowId: (user) => user.id,
    getFilteredRowModel: getFilteredRowModel(),
    data: users,
  });

  return (
    <>
      <div className="grid gap-8">
        <hgroup>
          <h2 className="mb-1 text-xl font-bold">Roles</h2>
          <p className="text-muted-foreground text-sm">Use roles to grant deeper access to your workspace.</p>
        </hgroup>
        {/* TODO (techdebt): Make column sizing work for data table */}
        <div className="md:[&_div]:!mx-0 md:[&_td:first-child]:!pl-0 md:[&_td:last-child]:w-14 md:[&_td:last-child]:!pr-0 md:[&_th:first-child]:!pl-0 md:[&_th:last-child]:w-14 md:[&_th:last-child]:!pr-0">
          {isLoading ? (
            <TableSkeleton columns={3} />
          ) : (
            <DataTable
              table={table}
              searchColumn="name"
              searchColumnPlaceholder="Search by name or email..."
              actions={
                <Button className="text-sm" onClick={() => setShowAddMemberModal(true)} size="small" variant="outline">
                  <Plus className="size-4" />
                  Add Member
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Dialog
        open={showAddMemberModal}
        onOpenChange={(open) => {
          setShowAddMemberModal(open);
          if (!open) {
            addMemberForm.clearErrors();
          }
        }}
      >
        <DialogContent className="text-black sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Add members</DialogTitle>
            <DialogDescription className="text-sm text-black">
              Select someone or invite by email to give them the role that fits the work they'll be doing.
            </DialogDescription>
          </DialogHeader>
          <Form {...addMemberForm}>
            <form onSubmit={(e) => void addMemberFormSubmit(e)} className="grid gap-y-4">
              <FormField
                control={addMemberForm.control}
                name="user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black">Name or email</FormLabel>
                    <FormControl>
                      <UnprivilegedUserComboBox
                        options={usersWithoutRoles}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Search by name or invite by email..."
                        size="small"
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
                    <FormLabel className="text-black">Role</FormLabel>
                    <FormControl>
                      <ComboBox
                        options={WORKSPACE_ROLE_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        size="small"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="mt-2 flex w-full justify-end">
                {/* Because typescript :( */}
                {inviteUserToWorkspace ? (
                  <MutationStatusButton
                    type="submit"
                    mutation={inviteUserToWorkspaceMutation}
                    loadingText="Adding member..."
                  >
                    <SendHorizontal className="size-4" />
                    Add Member
                  </MutationStatusButton>
                ) : (
                  <MutationStatusButton type="submit" mutation={changeRoleMutation} loadingText="Adding member...">
                    <SendHorizontal className="size-4" />
                    Add Member
                  </MutationStatusButton>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRevokeUser} onOpenChange={() => setConfirmRevokeUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Remove {confirmRevokeUser?.role.toLowerCase()} access for{" "}
              <span className="font-medium">{confirmRevokeUser?.name || confirmRevokeUser?.email}</span>?
            </DialogTitle>
            <DialogDescription>
              This will revoke their {confirmRevokeUser?.role.toLowerCase()} privileges. They'll still be a member of
              the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeUser(null)}>
              Cancel
            </Button>
            <Button
              variant="critical"
              onClick={() => {
                const role = ROLES_WHITELIST.safeParse(confirmRevokeUser?.role).data;
                if (confirmRevokeUser && role) {
                  revokeRoleMutation.mutate({
                    companyId: company.id,
                    userId: confirmRevokeUser.id,
                    role,
                  });
                  setConfirmRevokeUser(null);
                }
              }}
            >
              Remove {confirmRevokeUser?.role.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
