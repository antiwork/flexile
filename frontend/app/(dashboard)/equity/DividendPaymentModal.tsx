"use client";
import { AlertTriangle, CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import React from "react";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type Dividend = RouterOutput["dividends"]["list"][number];

interface DividendPaymentModalProps {
  dividend: Dividend | null;
  onClose: () => void;
}

const Item = ({ label, value }: { label: string; value: string | React.ReactNode }) => (
  <div className="flex justify-between gap-4 px-6">
    <div className="text-muted-foreground text-sm">{label}</div>
    <div className="text-right text-sm">{value}</div>
  </div>
);

const getPaymentStatusIcon = (status: string) => {
  switch (status) {
    case "succeeded":
      return <CheckCircle className="size-4 text-green-600" />;
    case "failed":
      return <XCircle className="size-4 text-red-600" />;
    case "processing":
      return <Clock className="size-4 text-blue-600" />;
    default:
      return <AlertTriangle className="size-4 text-yellow-600" />;
  }
};

const getTransferStatusColor = (status: string) => {
  switch (status) {
    case "outgoing_payment_sent":
      return "success";
    case "processing":
      return "primary";
    case "cancelled":
    case "rejected":
      return "critical";
    default:
      return undefined;
  }
};

export default function DividendPaymentModal({ dividend, onClose }: DividendPaymentModalProps) {
  const company = useCurrentCompany();
  const retriggerPayment = trpc.dividends.retriggerPayment.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  if (!dividend) return null;

  const payment = dividend.payments[0]?.dividendPayment;
  const hasPaymentChanged = payment && new Date(payment.updatedAt) > new Date(dividend.updatedAt);

  return (
    <Sheet open={!!dividend} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Dividend payment details</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 pb-6 not-print:overflow-y-auto">
          <h3 className="text-md px-6 font-medium">Dividend summary</h3>
          <Item label="Investor" value={dividend.investor.user.name || dividend.investor.user.email} />
          <Item label="Issue date" value={formatDate(dividend.dividendRound.issuedAt)} />
          <Item label="Total amount" value={formatMoneyFromCents(dividend.totalAmountInCents)} />
          <Item label="Number of shares" value={dividend.numberOfShares?.toLocaleString() || "N/A"} />
          <Item label="Status" value={<Status>{dividend.status}</Status>} />
          <Separator />

          {payment ? (
            <>
              <h3 className="text-md px-6 font-medium">Payment details</h3>
              <Item
                label="Payment status"
                value={
                  <div className="flex items-center gap-2">
                    {getPaymentStatusIcon(payment.status)}
                    <Status variant={payment.status === "succeeded" ? "success" : undefined}>{payment.status}</Status>
                  </div>
                }
              />
              <Item label="Processor" value={payment.processorName || "N/A"} />
              <Item label="Transfer ID" value={payment.transferId || "N/A"} />
              <Item
                label="Amount"
                value={
                  payment.transferAmount && payment.transferCurrency
                    ? `${payment.transferAmount} ${payment.transferCurrency}`
                    : formatMoneyFromCents(payment.totalTransactionCents || 0)
                }
              />
              <Item label="Account" value={`****${payment.recipientLast4 || "N/A"}`} />
              {payment.transferFeeInCents ? (
                <Item label="Transfer fee" value={formatMoneyFromCents(payment.transferFeeInCents)} />
              ) : null}
              {payment.wiseTransferEstimate ? (
                <Item label="Estimated delivery" value={formatDate(payment.wiseTransferEstimate)} />
              ) : null}
              {payment.transferStatus ? (
                <Item
                  label="Transfer status"
                  value={
                    <Status variant={getTransferStatusColor(payment.transferStatus)}>
                      {payment.transferStatus.replace(/_/gu, " ")}
                    </Status>
                  }
                />
              ) : null}
              <Separator />
              <Item label="Created" value={formatDate(payment.createdAt)} />
              <Item label="Updated" value={formatDate(payment.updatedAt)} />
            </>
          ) : (
            <>
              <h3 className="text-md px-6 font-medium">Payment details</h3>
              <div className="px-6 py-4 text-center">
                <AlertTriangle className="mx-auto mb-2 size-8 text-yellow-500" />
                <h4 className="font-semibold">No payment information</h4>
                <p className="text-muted-foreground text-sm">This dividend has not been processed for payment yet.</p>
              </div>
            </>
          )}
        </div>
        {payment && hasPaymentChanged ? (
          <SheetFooter>
            <div className="grid gap-4">
              <MutationButton
                param={{ companyId: company.id, dividendId: dividend.id.toString() }}
                mutation={retriggerPayment}
                errorText="Failed to retrigger payment. Please try again."
              >
                <RefreshCw className="mr-2 size-4" />
                Retrigger payment
              </MutationButton>
              <div className="text-xs">This will retry the payment process with updated information.</div>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
