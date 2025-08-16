"use client";

import { AlertTriangle, ArrowLeft, CheckCircle, DollarSign, RefreshCw, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type Dividend = RouterOutput["dividends"]["list"][number];

// Define status configuration type
type StatusKey = "pending" | "ready" | "processing" | "completed" | "failed" | "retained";

// Map backend status values to frontend status values
const normalizeStatus = (backendStatus: Dividend["status"]): StatusKey => {
  const statusMap: Record<Dividend["status"], StatusKey> = {
    "Pending signup": "pending",
    Issued: "ready",
    Processing: "processing",
    Paid: "completed",
    Retained: "retained",
  };
  return statusMap[backendStatus] || "pending";
};

// Status configuration for payment badges
const STATUS_BADGE_MAP = {
  pending: {
    color: "yellow",
    label: "Pending Setup",
    className: "border-yellow-200 text-yellow-700 bg-yellow-50",
  },
  ready: {
    color: "blue",
    label: "Ready to Pay",
    className: "border-blue-200 text-blue-700 bg-blue-50",
  },
  processing: {
    color: "orange",
    label: "Processing",
    className: "border-orange-200 text-orange-700 bg-orange-50",
  },
  completed: {
    color: "green",
    label: "Completed",
    className: "border-green-200 text-green-700 bg-green-50",
  },
  failed: {
    color: "red",
    label: "Failed",
    className: "border-red-200 text-red-700 bg-red-50",
  },
  retained: {
    color: "gray",
    label: "Retained (Below Threshold)",
    className: "border-gray-200 text-gray-700 bg-gray-50",
  },
} as const;

const columnHelper = createColumnHelper<Dividend>();

const paymentColumns = [
  columnHelper.accessor("investor.user.name", {
    header: "Recipient",
    cell: (info) => (
      <div className="flex flex-col">
        <strong>{info.getValue()}</strong>
        <span className="text-muted-foreground text-sm">{info.row.original.investor.user.email}</span>
      </div>
    ),
  }),
  columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
  columnHelper.accessor("status", {
    header: "Payment Status",
    cell: (info) => {
      const backendStatus = info.getValue();
      const status = normalizeStatus(backendStatus);
      const config = STATUS_BADGE_MAP[status];

      return (
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: (info) => {
      const backendStatus = info.row.original.status;
      const status = normalizeStatus(backendStatus);
      // TODO (techdebt): Wire up these actions to TRPC mutations for actual payment processing
      return (
        <div className="flex gap-2">
          {status === "failed" && (
            <Button size="small" variant="outline">
              <RefreshCw className="mr-1 h-4 w-4" />
              Retry
            </Button>
          )}
          {status === "ready" && (
            <Button size="small" variant="outline">
              Process Payment
            </Button>
          )}
          {status === "pending" && (
            <Button size="small" variant="outline">
              Mark Ready
            </Button>
          )}
        </div>
      );
    },
  }),
];

export default function DividendPaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch dividend round data
  const { data: dividends = [], isLoading } = trpc.dividends.list.useQuery({
    companyId: company.externalId,
    dividendRoundId: Number(id),
  });

  // Fetch account balances
  const { data: balances } = trpc.paymentManagement.getAccountBalances.useQuery({
    companyId: company.externalId,
  });

  // Payment statistics
  const paymentStats = {
    totalAmount: dividends.reduce((sum, d) => sum + Number(d.totalAmountInCents), 0),
    totalRecipients: dividends.length,
    readyToPay: dividends.filter((d) => normalizeStatus(d.status) === "ready").length,
    completed: dividends.filter((d) => normalizeStatus(d.status) === "completed").length,
    failed: dividends.filter((d) => normalizeStatus(d.status) === "failed").length,
    retained: dividends.filter((d) => normalizeStatus(d.status) === "retained").length,
  };

  const completionPercentage =
    paymentStats.totalRecipients > 0 ? Math.round((paymentStats.completed / paymentStats.totalRecipients) * 100) : 0;

  // Filter data for different table views
  const { pendingDividends, readyDividends, failedDividends } = React.useMemo(() => {
    const pending: Dividend[] = [];
    const ready: Dividend[] = [];
    const failed: Dividend[] = [];
    for (const d of dividends) {
      switch (normalizeStatus(d.status)) {
        case "pending": pending.push(d); break;
        case "ready": ready.push(d); break;
        case "failed": failed.push(d); break;
      }
    }
    return { pendingDividends: pending, readyDividends: ready, failedDividends: failed };
  }, [dividends]);

  const allPaymentsTable = useTable({ data: dividends, columns: paymentColumns });
  const pendingPaymentsTable = useTable({ data: pendingDividends, columns: paymentColumns });
  const readyPaymentsTable = useTable({ data: readyDividends, columns: paymentColumns });
  const failedPaymentsTable = useTable({ data: failedDividends, columns: paymentColumns });

  // Mutations for payment actions
  const pullFundsMutation = trpc.paymentManagement.pullFundsFromBank.useMutation({
    onSuccess: () => {
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
  });
  const transferToWiseMutation = trpc.paymentManagement.transferToWise.useMutation({
    onSuccess: () => {
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
  });
  const processPaymentsMutation = trpc.paymentManagement.processReadyPayments.useMutation({
    onSuccess: () => {
      void trpcUtils.dividends.list.invalidate();
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
  });

  const handlePullFunds = () => {
    pullFundsMutation.mutate({
      companyId: company.externalId,
      amountInCents: paymentStats.totalAmount,
    });
  };

  const handleTransferToWise = () => {
    transferToWiseMutation.mutate({
      companyId: company.externalId,
      amountInCents: paymentStats.totalAmount,
    });
  };

  const handleProcessPayments = () => {
    processPaymentsMutation.mutate({
      companyId: company.externalId,
      dividendRoundId: Number(id),
    });
  };

  if (isLoading) {
    return (
      <>
        <DashboardHeader title="Payment Management" />
        <TableSkeleton columns={4} />
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        title="Payment Management"
        headerActions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dividend
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoneyFromCents(paymentStats.totalAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recipients</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentStats.totalRecipients}</div>
              <p className="text-muted-foreground text-xs">{paymentStats.readyToPay} ready to pay</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentStats.completed}</div>
              <p className="text-muted-foreground text-xs">{completionPercentage}% complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertTriangle className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{paymentStats.failed}</div>
              <p className="text-muted-foreground text-xs">{paymentStats.retained} retained</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={completionPercentage} className="w-full" />
              <div className="text-muted-foreground flex justify-between text-sm">
                <span>
                  {paymentStats.completed} of {paymentStats.totalRecipients} payments completed
                </span>
                <span>{completionPercentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fund Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Stripe Balance</h4>
                <p className="text-2xl font-bold">
                  {formatMoneyFromCents(Number(balances?.stripe_balance_cents) || 0)}
                </p>
                <Button onClick={handlePullFunds} disabled={pullFundsMutation.isPending} className="w-full">
                  {pullFundsMutation.isPending ? "Pulling..." : "Pull Funds from Bank"}
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Wise Balance</h4>
                <p className="text-2xl font-bold">{formatMoneyFromCents(Number(balances?.wise_balance_cents) || 0)}</p>
                <Button
                  onClick={handleTransferToWise}
                  disabled={transferToWiseMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {transferToWiseMutation.isPending ? "Transferring..." : "Transfer to Wise"}
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Required</h4>
                <p className="text-2xl font-bold">{formatMoneyFromCents(paymentStats.totalAmount)}</p>
                <Button
                  onClick={handleProcessPayments}
                  disabled={paymentStats.readyToPay === 0 || processPaymentsMutation.isPending}
                  className="w-full"
                >
                  {processPaymentsMutation.isPending
                    ? "Processing..."
                    : `Process Ready Payments (${paymentStats.readyToPay})`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">All Payments</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingDividends.length})</TabsTrigger>
                <TabsTrigger value="ready">Ready ({paymentStats.readyToPay})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({paymentStats.failed})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <DataTable table={allPaymentsTable} />
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                <DataTable table={pendingPaymentsTable} />
              </TabsContent>

              <TabsContent value="ready" className="mt-4">
                <DataTable table={readyPaymentsTable} />
              </TabsContent>

              <TabsContent value="failed" className="mt-4">
                <DataTable table={failedPaymentsTable} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
