"use client";

import { PlusIcon } from "@heroicons/react/16/solid";
import { TrashIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React, { useCallback, useId, useMemo, useState } from "react";
import { type ControllerRenderProps, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

// Define the form schema
const investorSchema = z.object({
  investors: z
    .array(
      z.object({
        userId: z.string().min(1, "Please select an investor"),
        shares: z.number().min(1, "Please enter shares greater than 0"),
        searchTerm: z.string().optional(),
      }),
    )
    .min(1, "Please add at least one investor with shares"),
});

type InvestorFormData = z.infer<typeof investorSchema>;

// Separate component for investor search input
const InvestorSearchInput = ({
  fieldIndex,
  form,
  users,
  getAvailableUsers,
  hasError,
  field,
  isLoading,
}: {
  fieldIndex: number;
  form: ReturnType<typeof useForm<InvestorFormData>>;
  users: { id: string; name: string }[] | undefined;
  getAvailableUsers: (currentIndex: number, searchTerm?: string) => { value: string; label: string }[];
  hasError?: boolean;
  field: ControllerRenderProps<InvestorFormData, `investors.${number}.userId`>;
  isLoading?: boolean;
}) => {
  const fieldId = useId();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const searchTerm = form.watch(`investors.${fieldIndex}.searchTerm`) || "";
  const selectedUserId = form.watch(`investors.${fieldIndex}.userId`);
  const selectedUser = users?.find((user) => user.id === selectedUserId);
  const availableUsers = getAvailableUsers(fieldIndex, searchTerm);
  const displayValue = selectedUser ? selectedUser.name : searchTerm;

  return (
    <Command shouldFilter={false}>
      <Popover open={isPopoverOpen ? availableUsers.length > 0 : false}>
        <PopoverAnchor asChild>
          <Input
            id={fieldId}
            type="text"
            value={displayValue}
            autoComplete="off"
            aria-invalid={hasError}
            disabled={isLoading}
            onFocus={() => setIsPopoverOpen(true)}
            onBlur={() => setIsPopoverOpen(false)}
            onChange={(e) => {
              const value = e.target.value;
              form.setValue(`investors.${fieldIndex}.searchTerm`, value);
              field.onChange(""); // Use field.onChange to trigger validation
              setIsPopoverOpen(true);
            }}
            placeholder={isLoading ? "Loading investors..." : "Type to search investors..."}
          />
        </PopoverAnchor>
        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <CommandList>
            <CommandGroup>
              {availableUsers.map((user) => (
                <CommandItem
                  key={user.value}
                  value={user.value}
                  onSelect={(value) => {
                    field.onChange(value); // Use field.onChange to trigger validation
                    form.setValue(`investors.${fieldIndex}.searchTerm`, "");
                    setIsPopoverOpen(false);
                  }}
                >
                  {user.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
};

const AddCapTablePage = () => {
  const company = useCurrentCompany();
  const router = useRouter();
  const { data: users, isLoading } = trpc.companies.listCompanyUsers.useQuery({ companyId: company.id });
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Use React Hook Form with field array
  const form = useForm<InvestorFormData>({
    resolver: zodResolver(investorSchema),
    defaultValues: {
      investors: [{ userId: "", shares: 0, searchTerm: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "investors",
  });

  const utils = trpc.useUtils();
  const createCapTableMutation = trpc.capTable.create.useMutation({
    onSuccess: async () => {
      setMutationError(null); // Clear any previous errors
      await utils.capTable.show.invalidate({ companyId: company.id, newSchema: false });
      await utils.capTable.show.invalidate({ companyId: company.id, newSchema: true });
      router.push("/equity/investors");
    },
    onError: (error) => {
      setMutationError(error.message || "Failed to create cap table");
    },
  });

  // Watch the entire investors array for live updates
  const investorsWatch = form.watch("investors");

  // Clear investors error when form data changes (only clear custom errors, not Zod validation errors)
  React.useEffect(() => {
    if (
      form.formState.errors.investors?.message &&
      typeof form.formState.errors.investors === "object" &&
      !Array.isArray(form.formState.errors.investors)
    ) {
      form.clearErrors("investors");
    }
  }, [investorsWatch, form]);

  const getAvailableUsers = useCallback(
    (currentIndex: number, searchTerm = "") => {
      if (!users) return [];

      const selectedUserIds = investorsWatch
        .filter((field, index) => index !== currentIndex && field.userId !== "")
        .map((field) => field.userId);

      return users
        .filter((user) => !selectedUserIds.includes(user.id))
        .filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .map((user) => ({ value: user.id, label: user.name }));
    },
    [users, investorsWatch],
  );

  const handleAddInvestor = useCallback(() => {
    append({ userId: "", shares: 0, searchTerm: "" });
  }, [append]);

  const handleRemoveInvestor = useCallback(
    (index: number) => {
      if (fields.length > 1) {
        remove(index);
      }
    },
    [fields.length, remove],
  );

  const handleFinalizeCapTable = (data: InvestorFormData) => {
    // Clear any previous mutation errors when starting new submission
    setMutationError(null);

    // Zod validation handles all field validation, so we can directly use the data
    const investorsData = data.investors.map((inv) => ({
      userId: inv.userId,
      shares: inv.shares,
    }));

    createCapTableMutation.mutate({ companyId: company.id, investors: investorsData });
  };

  // Create table data with add row marker
  const tableData = useMemo(
    () => [...fields.map((field, index) => ({ ...field, _index: index })), { _isAddRow: true }],
    [fields],
  );

  const columnHelper = createColumnHelper<(typeof tableData)[0]>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("userId", {
        header: "Investor",
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) {
            return (
              <Button variant="link" onClick={handleAddInvestor}>
                <PlusIcon className="inline size-4" /> Add new investor
              </Button>
            );
          }

          const fieldIndex = row.original._index;

          return (
            <FormField
              control={form.control}
              name={`investors.${fieldIndex}.userId`}
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <InvestorSearchInput
                      fieldIndex={fieldIndex}
                      form={form}
                      users={users}
                      getAvailableUsers={getAvailableUsers}
                      hasError={!!fieldState.error}
                      field={field}
                      isLoading={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          );
        },
        footer: () => <div className="font-semibold">Total</div>,
      }),
      columnHelper.accessor("shares", {
        header: "Shares",
        meta: { numeric: true },
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) return null;

          const fieldIndex = row.original._index;

          return (
            <FormField
              control={form.control}
              name={`investors.${fieldIndex}.shares`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NumberInput
                      value={field.value}
                      onChange={(val) => field.onChange(val ?? 0)}
                      placeholder="0"
                      decimal={false}
                      className="ml-auto w-60"
                      aria-label="Number of shares"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          );
        },
        footer: () => {
          const allInvestors = form.watch("investors");
          const total = allInvestors.reduce((sum, inv) => sum + (Number(inv.shares) || 0), 0);
          return <div className="font-semibold">{total.toLocaleString()}</div>;
        },
      }),
      columnHelper.accessor("shares", {
        id: "ownership",
        header: "Ownership",
        meta: { numeric: true },
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) {
            return <div></div>;
          }

          const fieldIndex = row.original._index;
          const allInvestors = form.watch("investors");
          const liveShares = Number(allInvestors[fieldIndex]?.shares ?? 0);
          const totalShares = allInvestors.reduce((sum, inv) => sum + (Number(inv.shares) || 0), 0);
          const percentage = totalShares > 0 ? (liveShares / totalShares) * 100 : 0;

          return <div>{percentage.toFixed(1)}%</div>;
        },
        footer: () => <div className="font-semibold">100%</div>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) {
            return <div></div>;
          }

          const fieldIndex = row.original._index;

          return (
            <Button
              variant="link"
              onClick={() => handleRemoveInvestor(fieldIndex)}
              aria-label="Remove investor"
              disabled={fields.length === 1}
            >
              <TrashIcon className="size-4" />
            </Button>
          );
        },
        footer: () => <div></div>,
      }),
    ],
    [users, isLoading, fields.length, getAvailableUsers, form, handleAddInvestor, handleRemoveInvestor],
  );

  const table = useTable({
    columns,
    data: tableData,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(handleFinalizeCapTable)(e);
        }}
      >
        <DashboardHeader
          title="Cap table"
          headerActions={
            <Button
              type="submit"
              variant="default"
              size="default"
              className="bg-gray-800 hover:bg-gray-900"
              disabled={createCapTableMutation.isPending}
            >
              {createCapTableMutation.isPending ? "Creating..." : "Finalize cap table"}
            </Button>
          }
        />

        {/* Show form validation errors and mutation errors */}
        {(form.formState.errors.investors &&
          "message" in form.formState.errors.investors &&
          form.formState.errors.investors.message) ||
        (Array.isArray(form.formState.errors.investors) &&
          form.formState.errors.investors.some((investor) => investor)) ||
        mutationError ? (
          <div className="mx-4 mb-4">
            <Alert variant="destructive">
              <AlertDescription>
                {mutationError ||
                  (form.formState.errors.investors &&
                    "message" in form.formState.errors.investors &&
                    form.formState.errors.investors.message) ||
                  "Some investor details are missing. Please fill in all required fields before finalizing the cap table."}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="w-full">
          <DataTable table={table} />
        </div>
      </form>
    </Form>
  );
};

export default AddCapTablePage;
