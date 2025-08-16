"use client";

import {
  Calendar,
  CheckCircle2,
  CircleCheck,
  CreditCard,
  DollarSign,
  Eye,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type DividendRound = RouterOutput["dividendRounds"]["list"][number];
type DividendComputation = RouterOutput["dividendComputations"]["list"][number];

// Static mapping for Tailwind classes to ensure proper JIT compilation
const statusClassMap = {
  blue: "border-blue-200 text-blue-700 bg-blue-50",
  yellow: "border-yellow-200 text-yellow-700 bg-yellow-50",
  green: "border-green-200 text-green-700 bg-green-50",
  red: "border-red-200 text-red-700 bg-red-50",
  gray: "border-gray-200 text-gray-700 bg-gray-50",
} as const;

const getPaymentStatus = (round: DividendRound) => {
  // TODO (techdebt): Replace this local status computation with API-provided payment status
  // Mock payment status calculation - in real app would come from API

  const now = new Date();
  const issueDate = new Date(round.issuedAt);
  const daysSinceIssue = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceIssue < 1) {
    return { status: "processing", label: "Processing", color: "blue" as const };
  }
  if (daysSinceIssue < 7) {
    return { status: "paying", label: "Paying Out", color: "yellow" as const };
  }
  return { status: "completed", label: "Completed", color: "green" as const };
};

const computationColumnHelper = createColumnHelper<DividendComputation>();
const roundColumnHelper = createColumnHelper<DividendRound>();

export default function DividendRounds() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const { data: dividendRounds = [], isLoading: roundsLoading } = trpc.dividendRounds.list.useQuery({
    companyId: company.externalId,
  });
  const { data: dividendComputations = [], isLoading: computationsLoading } = trpc.dividendComputations.list.useQuery({
    companyId: company.externalId,
  });

  const finalizeMutation = trpc.dividendComputations.finalize.useMutation({
    onSuccess: async () => {
      // Invalidate queries instead of full page reload
      await trpcUtils.dividendRounds.list.invalidate();
      await trpcUtils.dividendComputations.list.invalidate();
    },
  });

  const isLoading = roundsLoading || computationsLoading;
  const canCreateDividends = user.roles.administrator || user.roles.lawyer;

  // Columns for pending computations
  const computationColumns = [
    computationColumnHelper.accessor("created_at", {
      header: "Created",
      cell: (info) => (
        <div className="flex items-center gap-3">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <div>
            <Link
              href={`/equity/dividend_computations/${info.row.original.id}`}
              className="font-medium no-underline hover:underline"
            >
              {formatDate(info.getValue())}
            </Link>
            <div className="text-muted-foreground text-sm">Computation #{info.row.original.id}</div>
          </div>
        </div>
      ),
    }),
    computationColumnHelper.accessor("total_amount_in_usd", {
      header: "Amount",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <DollarSign className="text-muted-foreground h-4 w-4" />
          <span className="font-medium">${info.getValue()?.toLocaleString()}</span>
        </div>
      ),
    }),
    computationColumnHelper.accessor("dividends_issuance_date", {
      header: "Issuance Date",
      cell: (info) => <div className="text-sm">{formatDate(info.getValue())}</div>,
    }),
    computationColumnHelper.display({
      id: "status",
      header: "Status",
      cell: () => (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          Pending Review
        </Badge>
      ),
    }),
    computationColumnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const computation = info.row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/equity/dividend_computations/${computation.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Review Details
              </DropdownMenuItem>
              {canCreateDividends && (
                <DropdownMenuItem
                  onClick={() => finalizeMutation.mutate({ companyId: company.externalId, id: computation.id })}
                  disabled={finalizeMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {finalizeMutation.isPending ? "Finalizing..." : "Finalize & Create Dividends"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  // Columns for finalized dividend rounds
  const roundColumns = [
    roundColumnHelper.accessor("issuedAt", {
      header: "Issue Date",
      cell: (info) => (
        <div className="flex items-center gap-3">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <div>
            <Link
              href={`/equity/dividend_rounds/${info.row.original.id}`}
              className="font-medium no-underline hover:underline"
            >
              {formatDate(info.getValue())}
            </Link>
            <div className="text-muted-foreground text-sm">Round #{info.row.original.id}</div>
          </div>
        </div>
      ),
    }),
    roundColumnHelper.accessor("totalAmountInCents", {
      header: "Amount",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <DollarSign className="text-muted-foreground h-4 w-4" />
          <span className="font-medium">{formatMoneyFromCents(info.getValue())}</span>
        </div>
      ),
    }),
    roundColumnHelper.accessor("numberOfShareholders", {
      header: "Recipients",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <span>{info.getValue()?.toLocaleString()} shareholders</span>
        </div>
      ),
    }),
    roundColumnHelper.display({
      id: "status",
      header: "Status",
      cell: (info) => {
        const round = info.row.original;
        const status = getPaymentStatus(round);

        return (
          <Badge variant="outline" className={statusClassMap[status.color]}>
            {status.label}
          </Badge>
        );
      },
    }),
    roundColumnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const round = info.row.original;
        const canManagePayments = user.roles.administrator || user.roles.lawyer;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/equity/dividend_rounds/${round.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {canManagePayments && (
                <DropdownMenuItem onClick={() => router.push(`/equity/dividend_rounds/${round.id}/payments`)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Payments
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  const computationTable = useTable({ columns: computationColumns, data: dividendComputations });
  const roundTable = useTable({ columns: roundColumns, data: dividendRounds });

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-between">
          <DashboardHeader title="Dividends" />
          {canCreateDividends && (
            <Button disabled className="mx-4">
              <Plus className="mr-2 h-4 w-4" />
              Create Dividend
            </Button>
          )}
        </div>
        <TableSkeleton columns={5} />
      </>
    );
  }

  const hasAnyData = dividendComputations.length > 0 || dividendRounds.length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <DashboardHeader title="Dividends" />
        {canCreateDividends && (
          <Button onClick={() => router.push("/equity/dividend_rounds/new")} className="mx-4">
            <Plus className="mr-2 h-4 w-4" />
            Create Dividend
          </Button>
        )}
      </div>

      {!hasAnyData ? (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>You have not created any dividend computations yet.</Placeholder>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Computations Section */}
          {dividendComputations.length > 0 && (
            <div className="mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Pending Computations</h3>
                <p className="text-muted-foreground text-sm">
                  Review and finalize dividend computations to create dividend rounds
                </p>
              </div>
              <DataTable table={computationTable} />
            </div>
          )}

          {/* Finalized Dividend Rounds Section */}
          {dividendRounds.length > 0 && (
            <div className="mx-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Dividend Rounds</h3>
                <p className="text-muted-foreground text-sm">Finalized dividend rounds with payment tracking</p>
              </div>
              <DataTable table={roundTable} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
