"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { ArrowLeft, DollarSign, Users, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type Dividend = RouterOutput["dividends"]["list"][number];

const columnHelper = createColumnHelper<Dividend>();

const paymentColumns = [
  columnHelper.accessor("investor.user.name", {
    header: "Recipient",
    cell: (info) => (
      <div className="flex flex-col">
        <strong>{info.getValue()}</strong>
        <span className="text-sm text-muted-foreground">
          {info.row.original.investor.user.email}
        </span>
      </div>
    ),
  }),
  columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
  columnHelper.accessor("status", {
    header: "Payment Status",
    cell: (info) => {
      const status = info.getValue();
      const statusConfig = {
        pending: { color: "yellow", label: "Pending Setup" },
        ready: { color: "blue", label: "Ready to Pay" },
        processing: { color: "orange", label: "Processing" },
        completed: { color: "green", label: "Completed" },
        failed: { color: "red", label: "Failed" },
        retained: { color: "gray", label: "Retained (Below Threshold)" },
      };
      
      const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
      
      return (
        <Badge variant="outline" className={`border-${config.color}-200 text-${config.color}-700 bg-${config.color}-50`}>
          {config.label}
        </Badge>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: (info) => {
      const status = info.row.original.status;
      
      return (
        <div className="flex gap-2">
          {(status as string) === "failed" && (
            <Button size="small" variant="outline">
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}
          {(status as string) === "ready" && (
            <Button size="small" variant="outline">
              Process Payment
            </Button>
          )}
          {(status as string) === "pending" && (
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
    readyToPay: dividends.filter(d => (d.status as string) === "ready").length,
    completed: dividends.filter(d => (d.status as string) === "completed").length,
    failed: dividends.filter(d => (d.status as string) === "failed").length,
    retained: dividends.filter(d => (d.status as string) === "retained").length,
  };

  const completionPercentage = paymentStats.totalRecipients > 0 
    ? Math.round((paymentStats.completed / paymentStats.totalRecipients) * 100)
    : 0;

  const table = useTable({ data: dividends, columns: paymentColumns });

  // Mutations for payment actions
  const pullFundsMutation = trpc.paymentManagement.pullFundsFromBank.useMutation();
  const transferToWiseMutation = trpc.paymentManagement.transferToWise.useMutation();
  const processPaymentsMutation = trpc.paymentManagement.processReadyPayments.useMutation();

  const handlePullFunds = async () => {
    try {
      await pullFundsMutation.mutateAsync({
        companyId: company.externalId,
        amountInCents: paymentStats.totalAmount,
      });
    } catch (error) {
      console.error("Error pulling funds:", error);
    }
  };

  const handleTransferToWise = async () => {
    try {
      await transferToWiseMutation.mutateAsync({
        companyId: company.externalId,
        amountInCents: paymentStats.totalAmount,
      });
    } catch (error) {
      console.error("Error transferring to Wise:", error);
    }
  };

  const handleProcessPayments = async () => {
    try {
      await processPaymentsMutation.mutateAsync({
        companyId: company.externalId,
        dividendRoundId: Number(id),
      });
    } catch (error) {
      console.error("Error processing payments:", error);
    }
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
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dividend
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Payment Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoneyFromCents(paymentStats.totalAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recipients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentStats.totalRecipients}</div>
              <p className="text-xs text-muted-foreground">
                {paymentStats.readyToPay} ready to pay
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentStats.completed}</div>
              <p className="text-xs text-muted-foreground">
                {completionPercentage}% complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{paymentStats.failed}</div>
              <p className="text-xs text-muted-foreground">
                {paymentStats.retained} retained
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={completionPercentage} className="w-full" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{paymentStats.completed} of {paymentStats.totalRecipients} payments completed</span>
                <span>{completionPercentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fund Management */}
        <Card>
          <CardHeader>
            <CardTitle>Fund Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Stripe Balance</h4>
                <p className="text-2xl font-bold">
                  {formatMoneyFromCents(balances?.stripe_balance_cents || 0)}
                </p>
                <Button 
                  onClick={handlePullFunds} 
                  disabled={pullFundsMutation.isPending}
                  className="w-full"
                >
                  {pullFundsMutation.isPending ? "Pulling..." : "Pull Funds from Bank"}
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Wise Balance</h4>
                <p className="text-2xl font-bold">
                  {formatMoneyFromCents(balances?.wise_balance_cents || 0)}
                </p>
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
                    : `Process Ready Payments (${paymentStats.readyToPay})`
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">All Payments</TabsTrigger>
                <TabsTrigger value="pending">Pending ({dividends.filter(d => (d.status as string) === "pending").length})</TabsTrigger>
                <TabsTrigger value="ready">Ready ({paymentStats.readyToPay})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({paymentStats.failed})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-4">
                <DataTable table={table} />
              </TabsContent>
              
              <TabsContent value="pending" className="mt-4">
                <DataTable 
                  table={useTable({ 
                    data: dividends.filter(d => (d.status as string) === "pending"), 
                    columns: paymentColumns 
                  })} 
                />
              </TabsContent>
              
              <TabsContent value="ready" className="mt-4">
                <DataTable 
                  table={useTable({ 
                    data: dividends.filter(d => (d.status as string) === "ready"), 
                    columns: paymentColumns 
                  })} 
                />
              </TabsContent>
              
              <TabsContent value="failed" className="mt-4">
                <DataTable 
                  table={useTable({ 
                    data: dividends.filter(d => (d.status as string) === "failed"), 
                    columns: paymentColumns 
                  })} 
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}