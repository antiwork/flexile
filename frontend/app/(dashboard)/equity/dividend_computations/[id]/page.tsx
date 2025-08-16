"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Download, Trash2 } from "lucide-react";

import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { MutationStatusButton } from "@/components/MutationButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { getPublicBackendUrl } from "@/utils/backend";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type ComputationOutput = {
  id: number;
  investor_name: string;
  share_class: string;
  number_of_shares: number;
  hurdle_rate?: number;
  original_issue_price_in_usd?: number;
  preferred_dividend_amount_in_usd: number;
  dividend_amount_in_usd: number;
  qualified_dividend_amount_usd: number;
  total_amount_in_usd: number;
};

const columnHelper = createColumnHelper<ComputationOutput>();
const columns = [
  columnHelper.accessor("investor_name", {
    header: "Investor",
    cell: (info) => <strong>{info.getValue()}</strong>,
  }),
  columnHelper.accessor("share_class", {
    header: "Share Class",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("number_of_shares", {
    header: "Shares",
    cell: (info) => info.getValue()?.toLocaleString(),
  }),
  columnHelper.accessor("preferred_dividend_amount_in_usd", {
    header: "Preferred",
    cell: (info) => formatMoney(info.getValue()),
  }),
  columnHelper.accessor("dividend_amount_in_usd", {
    header: "Common",
    cell: (info) => formatMoney(info.getValue()),
  }),
  columnHelper.accessor("qualified_dividend_amount_usd", {
    header: "Qualified",
    cell: (info) => formatMoney(info.getValue()),
  }),
  columnHelper.accessor("total_amount_in_usd", {
    header: "Total",
    cell: (info) => <strong>{formatMoney(info.getValue())}</strong>,
  }),
];

export default function DividendComputationReview() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const router = useRouter();

  const { data: computation, isLoading } = trpc.dividendComputations.get.useQuery({
    companyId: company.externalId,
    id: Number(id),
  });

  const deleteComputation = trpc.dividendComputations.delete.useMutation({
    onSuccess: () => {
      router.push("/equity/dividend_rounds");
    },
  });

  const finalizeComputation = trpc.dividendComputations.finalize.useMutation({
    onSuccess: (result: any) => {
      // Show payment result if available
      if (result?.payment_result?.error) {
        // Could show a toast notification here for payment processing failures
      }
      router.push(`/equity/dividend_rounds/${result?.id}`);
    },
  });

  // Move useTable hook to top level to avoid conditional hook calls
  const computationOutputs = (computation?.computation_outputs as ComputationOutput[]) || [];
  const table = useTable({
    columns,
    data: computationOutputs,
  });

  // Check if user has permission to approve dividends (admin or lawyer only)
  const canApproveDividends = user.roles.administrator || user.roles.lawyer;

  // Calculate estimated payment fees
  const calculatePaymentFees = (dividendAmount: number) => {
    const processingFee = Math.round(dividendAmount * 0.029) + 0.3;
    const transferFee = 5.0;
    return {
      dividendAmount,
      processingFee,
      transferFee,
      totalWithFees: dividendAmount + processingFee + transferFee,
    };
  };

  const handleExportCSV = () => {
    // Create a direct download link to the backend CSV export endpoint
    const csvUrl = `${getPublicBackendUrl()}/internal/companies/${company.externalId}/dividend_computations/${id}/export_csv`;

    // Create a temporary anchor element and trigger download
    const link = document.createElement("a");
    link.href = csvUrl;
    link.download = `dividend_computation_${id}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <>
        <DashboardHeader title="Loading..." />
        <div className="mx-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 rounded-lg bg-gray-200"></div>
            <div className="h-64 rounded-lg bg-gray-200"></div>
          </div>
        </div>
      </>
    );
  }

  if (!computation) {
    return (
      <>
        <DashboardHeader title="Computation Not Found" />
        <div className="mx-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>The dividend computation you're looking for could not be found.</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const totalAmountUsd = parseFloat(
    (computation as any)?.total_amount_in_usd || (computation as any)?.totalAmountInUsd || "0"
  );
  const totals = (computation as any)?.totals;
  const fees = calculatePaymentFees(totalAmountUsd);

  return (
    <>
      <DashboardHeader
        title="Review Dividend Computation"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/equity/dividend_rounds">Back to Dividends</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Computation Summary</CardTitle>
            <CardDescription>Review the dividend computation details before finalizing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold">{formatMoney(totalAmountUsd)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Issuance Date</p>
                <p className="text-lg">
                  {formatDate(computation.dividends_issuance_date || computation.dividendsIssuanceDate)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Type</p>
                <p className="text-lg">
                  {(computation.return_of_capital ?? computation.returnOfCapital)
                    ? "Return of Capital"
                    : "Regular Dividend"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {canApproveDividends ? (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Next Steps:</strong> This computation will calculate dividend distributions for all eligible
              shareholders. Once you approve and generate dividends, individual dividend records will be created and
              shareholders will be notified.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Approval Required:</strong> Only company administrators and legal team members can approve and
              generate dividends. Please contact an admin or legal team member to proceed with this computation.
            </AlertDescription>
          </Alert>
        )}

        {canApproveDividends ? (
          <Card>
            <CardHeader>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>Estimated fees for processing dividend payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Dividend Amount</p>
                  <p className="text-lg font-semibold">{formatMoney(fees.dividendAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Processing Fee (2.9% + $0.30)</p>
                  <p className="text-lg">{formatMoney(fees.processingFee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Transfer Fee</p>
                  <p className="text-lg">{formatMoney(fees.transferFee)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Charge</p>
                  <p className="text-xl font-bold">{formatMoney(fees.totalWithFees)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {totals ? (
          <Card>
            <CardHeader>
              <CardTitle>Computation Totals</CardTitle>
              <CardDescription>Summary of dividend calculations by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Shareholders</p>
                  <p className="text-xl font-semibold">{totals.total_shareholders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Preferred Dividends</p>
                  <p className="text-xl font-semibold">{formatMoney(totals.total_preferred_dividends)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Common Dividends</p>
                  <p className="text-xl font-semibold">{formatMoney(totals.total_common_dividends)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Qualified Dividends</p>
                  <p className="text-xl font-semibold">{formatMoney(totals.total_qualified_dividends)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Per-Investor Breakdown</CardTitle>
            <CardDescription>Detailed dividend calculations for each investor</CardDescription>
          </CardHeader>
          <CardContent>
            {computationOutputs.length > 0 ? (
              <DataTable table={table} />
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="text-muted-foreground">
                  No computation outputs available. This computation may not have been processed yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <MutationStatusButton
            idleVariant="destructive"
            mutation={deleteComputation}
            loadingText="Deleting..."
            onClick={() => deleteComputation.mutate({ companyId: company.externalId, id: Number(id) })}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Computation
          </MutationStatusButton>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={computationOutputs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/equity/dividend_rounds/new`}>Edit</Link>
            </Button>
            {canApproveDividends ? (
              <MutationStatusButton
                mutation={finalizeComputation}
                loadingText="Generating dividends..."
                onClick={() => finalizeComputation.mutate({ companyId: company.externalId, id: Number(id) })}
                disabled={computationOutputs.length === 0}
              >
                Approve & Generate Dividends
              </MutationStatusButton>
            ) : (
              <Button disabled variant="outline">
                Approve & Generate Dividends (Admin/Legal Only)
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
