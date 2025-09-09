"use client";

import { PlusIcon } from "@heroicons/react/16/solid";
import { TrashIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useId, useMemo, useState } from "react";
import { type ControllerRenderProps, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { useIsMobile } from "@/utils/use-mobile";

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

const calculateTotalShares = (investors: InvestorFormData["investors"]) =>
  investors.reduce((sum, inv) => sum + (Number(inv.shares) || 0), 0);

const calculateOwnershipPercentage = (shares: number, totalShares: number) =>
  totalShares > 0 ? (shares / totalShares) * 100 : 0;

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
  isLoading: boolean;
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
              field.onChange("");
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
                    field.onChange(value);
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

const InvestorFormFields = ({
  fieldIndex,
  form,
  users,
  getAvailableUsers,
  isLoading,
}: {
  fieldIndex: number;
  form: ReturnType<typeof useForm<InvestorFormData>>;
  users: { id: string; name: string }[] | undefined;
  getAvailableUsers: (currentIndex: number, searchTerm?: string) => { value: string; label: string }[];
  isLoading: boolean;
}) => ({
  InvestorField: (
    <FormField
      control={form.control}
      name={`investors.${fieldIndex}.userId`}
      render={({ field, fieldState }) => (
        <FormItem className="mt-1">
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
  ),
  SharesField: (
    <FormField
      control={form.control}
      name={`investors.${fieldIndex}.shares`}
      render={({ field }) => (
        <FormItem className="mt-1">
          <FormControl>
            <NumberInput
              value={field.value}
              onChange={(val) => field.onChange(val ?? 0)}
              placeholder="0"
              decimal={false}
              className="w-full"
              aria-label="Number of shares"
            />
          </FormControl>
        </FormItem>
      )}
    />
  ),
});

const MobileInvestorCard = ({
  fieldIndex,
  form,
  users,
  getAvailableUsers,
  isLoading,
  handleRemoveInvestor,
  fieldsLength,
}: {
  fieldIndex: number;
  form: ReturnType<typeof useForm<InvestorFormData>>;
  users: { id: string; name: string }[] | undefined;
  getAvailableUsers: (currentIndex: number, searchTerm?: string) => { value: string; label: string }[];
  isLoading: boolean;
  handleRemoveInvestor: (index: number) => void;
  fieldsLength: number;
}) => {
  const allInvestors = form.watch("investors");
  const liveShares = Number(allInvestors[fieldIndex]?.shares ?? 0);
  const totalShares = calculateTotalShares(allInvestors);
  const percentage = calculateOwnershipPercentage(liveShares, totalShares);
  const formFields = InvestorFormFields({ fieldIndex, form, users, getAvailableUsers, isLoading });

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-600">Investor {fieldIndex + 1}</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveInvestor(fieldIndex)}
            disabled={fieldsLength === 1}
            className="size-11 shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={`Remove investor ${fieldIndex + 1}`}
          >
            <TrashIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Investor</Label>
            {formFields.InvestorField}
          </div>

          <div>
            <Label className="text-sm font-medium">Shares</Label>
            {formFields.SharesField}
          </div>

          <div className="border-t border-gray-100 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Ownership:</span>
              <span className="font-medium">{percentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AddCapTablePage = () => {
  const company = useCurrentCompany();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { data: users, isLoading } = trpc.companies.listCompanyUsers.useQuery({ companyId: company.id });
  const [mutationError, setMutationError] = useState<string | null>(null);

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
      setMutationError(null);
      await utils.capTable.show.invalidate({ companyId: company.id, newSchema: false });
      await utils.capTable.show.invalidate({ companyId: company.id, newSchema: true });
      router.push("/equity/investors");
    },
    onError: (error) => {
      setMutationError(error.message || "Failed to create cap table");
    },
  });

  const investorsWatch = form.watch("investors");

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
    setMutationError(null);

    const investorsData = data.investors.map((inv) => ({
      userId: inv.userId,
      shares: inv.shares,
    }));

    createCapTableMutation.mutate({ companyId: company.id, investors: investorsData });
  };

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
              <div className="mt-1">
                <Button variant="link" onClick={handleAddInvestor} className="inline-flex items-center">
                  <PlusIcon className="size-4 align-middle" />
                  <span className="align-middle">Add new investor</span>
                </Button>
              </div>
            );
          }

          const fieldIndex = row.original._index;
          const formFields = InvestorFormFields({ fieldIndex, form, users, getAvailableUsers, isLoading });
          return formFields.InvestorField;
        },
        footer: () => <div className="font-semibold">Total</div>,
      }),
      columnHelper.accessor("shares", {
        header: "Shares",
        meta: { numeric: true },
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) return null;

          const fieldIndex = row.original._index;
          const formFields = InvestorFormFields({ fieldIndex, form, users, getAvailableUsers, isLoading });
          return <div className="ml-auto w-full max-w-[160px]">{formFields.SharesField}</div>;
        },
        footer: () => {
          const totalShares = calculateTotalShares(form.watch("investors"));
          return <div className="font-semibold">{totalShares.toLocaleString()}</div>;
        },
      }),
      columnHelper.accessor("shares", {
        id: "ownership",
        header: "Ownership",
        meta: { numeric: true },
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) return null;

          const fieldIndex = row.original._index;
          const allInvestors = form.watch("investors");
          const liveShares = Number(allInvestors[fieldIndex]?.shares ?? 0);
          const totalShares = calculateTotalShares(allInvestors);
          const percentage = calculateOwnershipPercentage(liveShares, totalShares);

          return <div>{percentage.toFixed(1)}%</div>;
        },
        footer: () => <div className="font-semibold">100%</div>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if ("_isAddRow" in row.original) return null;

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

  const hasFormErrors =
    (form.formState.errors.investors &&
      "message" in form.formState.errors.investors &&
      form.formState.errors.investors.message) ||
    (Array.isArray(form.formState.errors.investors) && form.formState.errors.investors.some((investor) => investor)) ||
    mutationError;

  const errorMessage =
    mutationError ||
    (form.formState.errors.investors &&
      "message" in form.formState.errors.investors &&
      form.formState.errors.investors.message) ||
    null;

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

        {hasFormErrors ? (
          <Alert className="mx-4 mt-2 mb-4" variant="destructive">
            <AlertTriangle className="my-auto max-h-4 max-w-4" />
            {!errorMessage ? (
              <>
                <AlertTitle>Some investor details are missing.</AlertTitle>
                <AlertDescription>Please fill in all required fields before finalizing the cap table.</AlertDescription>
              </>
            ) : (
              <AlertDescription>{errorMessage}</AlertDescription>
            )}
          </Alert>
        ) : null}

        <div className="w-full">
          {isMobile ? (
            <div className="space-y-4 px-4">
              {fields.map((field, index) => (
                <MobileInvestorCard
                  key={field.id}
                  fieldIndex={index}
                  form={form}
                  users={users}
                  getAvailableUsers={getAvailableUsers}
                  isLoading={isLoading}
                  handleRemoveInvestor={handleRemoveInvestor}
                  fieldsLength={fields.length}
                />
              ))}

              <Button type="button" variant="outline" onClick={handleAddInvestor} className="w-full">
                <PlusIcon className="mr-2 inline size-4" />
                Add new investor
              </Button>

              <Card className="bg-gray-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total</span>
                    <div className="font-semibold">
                      {calculateTotalShares(form.watch("investors")).toLocaleString()} shares
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <DataTable table={table} />
          )}
        </div>
      </form>
    </Form>
  );
};

export default AddCapTablePage;
