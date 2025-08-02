"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Check, ChevronDown, Mail, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";

const addMemberSchema = z.object({
  memberOrEmail: z
    .string()
    .min(1, "Please select a member or enter an email")
    .refine((value) => {
      // If it's an email (contains @), validate it as an email
      if (value.includes("@")) {
        return z.string().email("Please enter a valid email address").safeParse(value).success;
      }
      // If it's not an email, it should be a valid user ID (non-empty string)
      return value.length > 0;
    }, "Please enter a valid email address or select a member"),
  role: z.enum(["admin", "lawyer"]),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserOrEmailInputProps {
  value: string;
  onChange: (value: string) => void;
  users: User[];
  placeholder?: string;
  className?: string;
}

const UserOrEmailInput = ({
  value,
  onChange,
  users,
  placeholder = "Search by name or enter email...",
  className,
}: UserOrEmailInputProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const listRef = useRef<HTMLDivElement>(null);

  const getDisplayValue = () => {
    if (!value) return "";
    const user = users.find((u) => u.id === value);
    if (user) {
      return `${user.name} (${user.email})`;
    }
    return value; // Return the email if no user found
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleUserSelect = (userId: string) => {
    onChange(userId);
    setInputValue(userId);
    setOpen(false);
  };

  // Update inputValue when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(inputValue.toLowerCase()) ||
      user.email.toLowerCase().includes(inputValue.toLowerCase()),
  );

  // More comprehensive email regex pattern
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/u;
  const isEmail = emailRegex.test(inputValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="small"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full min-w-0 justify-between", className)}
          onClick={() => setOpen(true)}
        >
          <div className="truncate">{getDisplayValue() || placeholder}</div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <CommandInput
            placeholder="Search by name or enter email..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList ref={listRef}>
            <CommandEmpty>
              {isEmail ? (
                <div className="flex items-center gap-2 p-2">
                  <Mail className="size-4" />
                  <span>Invite {inputValue}</span>
                </div>
              ) : (
                "No results found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  keywords={[user.name, user.email]}
                  onSelect={handleUserSelect}
                >
                  <Check className={cn("mr-2 h-4 w-4", user.id === value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                  </div>
                </CommandItem>
              ))}
              {isEmail && !users.some((u) => u.email === inputValue) ? (
                <CommandItem value={inputValue} onSelect={() => handleUserSelect(inputValue)}>
                  <Mail className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Invite {inputValue}</span>
                    <span className="text-muted-foreground text-xs">New user</span>
                  </div>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

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

  const inviteLawyerMutation = trpc.lawyers.invite.useMutation({
    onSuccess: async () => {
      await trpcUtils.companies.listAdministrators.invalidate();
      await trpcUtils.companies.listLawyers.invalidate();
      setShowAddModal(false);
      addMemberForm.reset();
    },
  });

  const inviteAdminMutation = trpc.administrators.invite.useMutation({
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
    defaultValues: { memberOrEmail: "", role: "admin" },
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
        meta: { className: "w-6 whitespace-nowrap" },
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
    // More comprehensive email regex pattern (same as in UserOrEmailInput)
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/u;
    const isEmail = emailRegex.test(values.memberOrEmail);
    const existingUser = companyUsers.find((u) => u.id === values.memberOrEmail);

    if (existingUser) {
      addRoleMutation.mutate({
        companyId: company.id,
        userId: values.memberOrEmail,
        role: values.role,
      });
    } else if (isEmail) {
      if (values.role === "admin") {
        inviteAdminMutation.mutate({
          companyId: company.id,
          email: values.memberOrEmail,
        });
      } else {
        inviteLawyerMutation.mutate({
          companyId: company.id,
          email: values.memberOrEmail,
        });
      }
    }
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
        <div className="[&_td:first-child]:!pl-0 [&_td:last-child]:!pr-0 [&_td:last-child]:!pr-2 [&_td:nth-child(2)]:!pr-0 [&_th:first-child]:!pl-0 [&_th:last-child]:!pr-0 [&_th:nth-child(2)]:!pr-0">
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
              Select someone or invite by email to give them the role that fits the work they'll be doing.
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
                name="memberOrEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name or email</FormLabel>
                    <FormControl>
                      <UserOrEmailInput
                        {...field}
                        users={companyUsers}
                        placeholder="Search by name or enter email..."
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
                      <ComboBox
                        options={[
                          { value: "admin", label: "Admin" },
                          { value: "lawyer", label: "Lawyer" },
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select role..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={
                    !addMemberForm.formState.isValid ||
                    addRoleMutation.isPending ||
                    inviteLawyerMutation.isPending ||
                    inviteAdminMutation.isPending
                  }
                >
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
