"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

type Investor = {
  id: string;
  userId: string | null;
  shares: number;
};

type User = {
  id: string;
  name: string;
};

const AddCapTablePage = () => {
  const company = useCurrentCompany();
  const router = useRouter();
  const { data: users, isLoading } = trpc.companies.listCompanyUsers.useQuery({ companyId: company.id });
  const [investors, setInvestors] = useState<Investor[]>([{ id: "1", userId: null, shares: 0 }]);

  const [error, setError] = useState<string | null>(null);

  const createCapTableMutation = trpc.capTable.create.useMutation({
    onSuccess: () => {
      router.push("/equity/investors");
    },
    onError: (error) => {
      setError(error.message || "Failed to create cap table");
    },
  });

  const totalShares = useMemo(() => investors.reduce((sum, i) => sum + (Number(i.shares) || 0), 0), [investors]);

  const handleInvestorChange = (id: string, field: "userId" | "shares", value: string | number) => {
    setInvestors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const handleAddInvestor = () => {
    const newId = (investors.length + 1).toString();
    setInvestors((prev) => [...prev, { id: newId, userId: null, shares: 0 }]);
  };

  const handleRemoveInvestor = (id: string) => {
    setInvestors((prev) => prev.filter((inv) => inv.id !== id));
  };

  const handleFinalizeCapTable = () => {
    setError(null); // Clear previous errors

    // Validate that all investors have been selected and have shares
    const validInvestors = investors.filter(
      (inv): inv is Investor & { userId: string } => inv.userId !== null && inv.shares > 0,
    );

    if (validInvestors.length === 0) {
      setError("Please add at least one investor with shares");
      return;
    }

    if (validInvestors.length !== investors.length) {
      setError("Please complete all investor information");
      return;
    }

    // Transform data for the API
    const investorsData = validInvestors.map((inv) => ({
      userId: inv.userId,
      shares: inv.shares,
    }));

    createCapTableMutation.mutate({ companyId: company.id, investors: investorsData });
  };

  const columnHelper = createColumnHelper<Investor>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("userId", {
        header: "Investor",
        cell: ({ row }) => {
          if (row.original.id === "add") {
            return (
              <Button
                variant="link"
                size="small"
                onClick={handleAddInvestor}
                className="h-auto px-0 font-normal text-blue-600"
              >
                <Plus className="mr-1 size-4" /> Add new investor
              </Button>
            );
          }
          return (
            <ComboBox
              options={users?.map((u: User) => ({ value: u.id, label: u.name })) || []}
              value={row.original.userId}
              onChange={(val) => handleInvestorChange(row.original.id, "userId", val)}
              placeholder={isLoading ? "Loading..." : "Select investor"}
              className="w-full min-w-140 border-none bg-transparent text-base font-normal shadow-none focus:ring-0 focus:outline-none"
            />
          );
        },
        footer: () => <div className="font-semibold">Total</div>,
      }),
      columnHelper.accessor("shares", {
        header: "Shares",
        meta: { numeric: true },
        cell: ({ row }) => {
          if (row.original.id === "add") {
            return <div></div>;
          }
          return (
            <Input
              type="number"
              value={row.original.shares || ""}
              onChange={(e) => handleInvestorChange(row.original.id, "shares", parseInt(e.target.value, 10) || 0)}
              placeholder="0"
              className="ml-auto w-60"
            />
          );
        },
        footer: () => <div className="font-semibold">{totalShares.toLocaleString()}</div>,
      }),
      columnHelper.accessor("shares", {
        id: "ownership",
        header: "Ownership",
        meta: { numeric: true },
        cell: ({ row }) => {
          if (row.original.id === "add") {
            return <div></div>;
          }
          return (
            <div>{totalShares > 0 ? `${((Number(row.original.shares) / totalShares) * 100).toFixed(0)}%` : "0%"}</div>
          );
        },
        footer: () => <div className="font-semibold">100%</div>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (row.original.id === "add") {
            return <div></div>;
          }
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveInvestor(row.original.id)}
              aria-label="Remove investor"
              disabled={investors.length === 1}
              className="h-10 w-10 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="size-5" />
            </Button>
          );
        },
        footer: () => <div></div>,
      }),
    ],
    [users, isLoading, totalShares, investors.length],
  );

  const tableData = useMemo(() => {
    const addRow: Investor = { id: "add", userId: null, shares: 0 };
    return [...investors, addRow];
  }, [investors]);

  const table = useTable({
    columns,
    data: tableData,
  });

  return (
    <>
      <DashboardHeader
        title="Cap table"
        headerActions={
          <Button
            variant="default"
            size="default"
            className="bg-gray-800 hover:bg-gray-900"
            onClick={handleFinalizeCapTable}
            disabled={createCapTableMutation.isPending}
          >
            {createCapTableMutation.isPending ? "Creating..." : "Finalize cap table"}
          </Button>
        }
      />

      {error ? (
        <div className="mx-4 mb-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="w-full">
        <DataTable table={table} />
      </div>
    </>
  );
};

export default AddCapTablePage;
