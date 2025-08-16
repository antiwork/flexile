"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";

interface PaymentStats {
  totalAmount: number;
  totalRecipients: number;
  readyToPay: number;
  completed: number;
  failed: number;
  retained: number;
}

interface FundManagementProps {
  dividendRoundId: number;
  paymentStats: PaymentStats;
  balances?: RouterOutput["paymentManagement"]["getAccountBalances"];
}

export function FundManagement({ dividendRoundId, paymentStats, balances }: FundManagementProps) {
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();

  const pullFundsMutation = trpc.paymentManagement.pullFundsFromBank.useMutation({
    onSuccess: () => {
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
    onError: () => {
      // TODO (techdebt): Add proper error handling for pull funds failures
    },
  });

  const transferToWiseMutation = trpc.paymentManagement.transferToWise.useMutation({
    onSuccess: () => {
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
    onError: () => {
      // TODO (techdebt): Add proper error handling for transfer to Wise failures
    },
  });

  const processPaymentsMutation = trpc.paymentManagement.processReadyPayments.useMutation({
    onSuccess: () => {
      void trpcUtils.dividends.list.invalidate();
      void trpcUtils.paymentManagement.getAccountBalances.invalidate();
    },
    onError: () => {
      // TODO (techdebt): Add proper error handling for process payments failures
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
      dividendRoundId,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <h4 className="font-medium">Stripe Balance</h4>
            <p className="text-2xl font-bold">{formatMoneyFromCents(Number(balances?.stripe_balance_cents) || 0)}</p>
            <Button
              onClick={handlePullFunds}
              disabled={pullFundsMutation.isPending || paymentStats.totalAmount === 0}
              className="w-full"
            >
              {pullFundsMutation.isPending ? "Pulling..." : "Pull Funds from Bank"}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Wise Balance</h4>
            <p className="text-2xl font-bold">{formatMoneyFromCents(Number(balances?.wise_balance_cents) || 0)}</p>
            <Button
              onClick={handleTransferToWise}
              disabled={transferToWiseMutation.isPending || paymentStats.totalAmount === 0}
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
  );
}
