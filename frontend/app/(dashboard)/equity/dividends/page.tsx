"use client";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import DividendStatusIndicator from "@/app/(dashboard)/equity/DividendStatusIndicator";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import RichText from "@/components/RichText";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_dividend_path, company_switch_path, sign_company_dividend_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

type Dividend = RouterOutput["dividends"]["list"][number];
const columnHelper = createColumnHelper<Dividend>();
export default function Dividends() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const companyIdParam = searchParams.get("company_id");

  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    try {
      await request({
        method: "POST",
        url: company_switch_path(companyId),
        accept: "json",
      });
      await queryClient.resetQueries({ queryKey: ["currentUser", user.email] });
      router.replace("/equity/dividends");
    } finally {
      useUserStore.setState((state) => ({ ...state, pending: false }));
    }
  };

  useEffect(() => {
    if (!companyIdParam) return;
    if (companyIdParam !== company.externalId) {
      const targetCompany = user.companies.find((c) => c.externalId === companyIdParam);
      if (targetCompany && targetCompany.id !== company.id) {
        void switchCompany(targetCompany.id);
      } else {
        router.replace("/equity/dividends");
      }
    }
  }, [companyIdParam, company.externalId, company.id, user.companies, user.email]);

  const {
    data = [],
    refetch,
    isLoading,
  } = trpc.dividends.list.useQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id,
  });
  const [signingDividend, setSigningDividend] = useState<{
    id: bigint;
    state: "initial" | "signing" | "signed";
  } | null>(null);
  const { data: dividendData } = useQuery({
    queryKey: ["dividend", signingDividend?.id],
    queryFn: signingDividend
      ? async () => {
          const response = await request({
            url: company_dividend_path(company.id, signingDividend.id),
            accept: "json",
            method: "GET",
            assertOk: true,
          });
          return z
            .object({
              total_amount_in_cents: z.number(),
              cumulative_return: z.number().nullable(),
              withheld_tax_cents: z.number().nullable(),
              bank_account_last_4: z.string(),
              release_document: z.string(),
            })
            .parse(await response.json());
        }
      : skipToken,
  });

  const signDividend = useMutation({
    mutationFn: async () => {
      if (!signingDividend) return;
      await request({
        url: sign_company_dividend_path(company.id, signingDividend.id),
        accept: "json",
        method: "POST",
        assertOk: true,
      });
    },
    onSuccess: () => {
      setSigningDividend(null);
      void refetch();
    },
  });

  const hasLegalDetails = user.legalName && user.address.street_address && user.taxInformationConfirmedAt;
  const columns = useMemo(
    () => [
      columnHelper.simple("dividendRound.issuedAt", "Issue date", formatDate),
      columnHelper.simple("dividendRound.returnOfCapital", "Type", (value) =>
        value ? "Return of capital" : "Dividend",
      ),
      columnHelper.simple("numberOfShares", "Shares held", (value) => value?.toLocaleString() ?? "N/A", "numeric"),
      columnHelper.simple("totalAmountInCents", "Gross amount", (value) => formatMoneyFromCents(value), "numeric"),
      columnHelper.simple("withheldTaxCents", "Withheld taxes", (value) => formatMoneyFromCents(value ?? 0), "numeric"),
      columnHelper.simple("netAmountInCents", "Net amount", (value) => formatMoneyFromCents(value ?? 0), "numeric"),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <div className="flex min-h-8 justify-between gap-2">
            <DividendStatusIndicator dividend={info.row.original} />
            {info.row.original.investor.user.id === user.id &&
            hasLegalDetails &&
            user.hasPayoutMethodForDividends &&
            info.row.original.dividendRound.releaseDocument &&
            !info.row.original.signedReleaseAt ? (
              <Button size="small" onClick={() => setSigningDividend({ id: info.row.original.id, state: "initial" })}>
                Sign
              </Button>
            ) : null}
          </div>
        ),
      }),
    ],
    [],
  );
  const table = useTable({ columns, data });
  return (
    <>
      <DashboardHeader title="Dividends" />

      {!hasLegalDetails ? (
        <Alert className="mx-4">
          <Info />
          <AlertDescription>
            Please{" "}
            <Link className={linkClasses} href="/settings/tax">
              provide your legal details
            </Link>{" "}
            so we can pay you.
          </AlertDescription>
        </Alert>
      ) : !user.hasPayoutMethodForDividends ? (
        <Alert className="mx-4">
          <Info />
          <AlertDescription>
            Please{" "}
            <Link className={linkClasses} href="/settings/payouts">
              provide a payout method
            </Link>{" "}
            for your dividends.
          </AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <TableSkeleton columns={7} />
      ) : data.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>You have not been issued any dividends yet.</Placeholder>
        </div>
      )}
      <Dialog open={!!dividendData} onOpenChange={() => setSigningDividend(null)}>
        <DialogContent>
          {dividendData && signingDividend && hasLegalDetails && user.legalName ? (
            signingDividend.state !== "initial" ? (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle>Release agreement</DialogTitle>
                  <DialogDescription>
                    Please review and sign this agreement to receive your payout. This document outlines the terms and
                    conditions for the return of capital.
                  </DialogDescription>
                </DialogHeader>
                <div className="border-muted my-2 max-h-100 overflow-y-auto rounded-md border px-8 py-4">
                  <RichText
                    content={dividendData.release_document
                      .replaceAll("{{investor}}", user.legalName)
                      .replaceAll("{{amount}}", formatMoneyFromCents(dividendData.total_amount_in_cents))}
                  />
                </div>
                <div className="grid gap-2">
                  <h3>Your signature</h3>
                  {signingDividend.state === "signing" ? (
                    <Button
                      className="border-muted w-full hover:border-current"
                      variant="dashed"
                      onClick={() => setSigningDividend({ ...signingDividend, state: "signed" })}
                    >
                      Add your signature
                    </Button>
                  ) : (
                    <div className="font-signature border-b text-xl">{user.legalName}</div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    By clicking the button above, you agree to using an electronic representation of your signature for
                    all purposes within Flexile, just the same as a pen-and-paper signature.
                  </div>
                </div>
                <DialogFooter>
                  <MutationButton
                    mutation={signDividend}
                    disabled={signingDividend.state !== "signed"}
                    errorText="Something went wrong. Please try again."
                  >
                    Accept funds
                  </MutationButton>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle>Dividend details</DialogTitle>
                </DialogHeader>
                <Card className="my-2 rounded-lg bg-gray-50/50">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="bg-muted size-12 rounded-lg">
                      <AvatarImage src={company.logo_url ?? "/images/default-company-logo.svg"} />
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-muted-foreground text-sm font-medium">{company.name}</div>
                      <div className="font-semibold">Return of capital</div>
                    </div>
                    <div className="self-end pb-1 font-semibold">
                      {formatMoneyFromCents(dividendData.total_amount_in_cents)}
                    </div>
                  </CardContent>
                </Card>
                <div className="pb-4">
                  {dividendData.cumulative_return ? (
                    <>
                      <div className="flex justify-between gap-2">
                        <h3 className="font-medium">Cumulative return</h3>
                        <span>{dividendData.cumulative_return.toLocaleString([], { style: "percent" })}</span>
                      </div>
                      <Separator />
                    </>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <h3 className="font-medium">Taxes withheld</h3>
                    <span>{formatMoneyFromCents(dividendData.withheld_tax_cents ?? 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <h3 className="font-medium">Payout method</h3>
                    <span>Account ending in {dividendData.bank_account_last_4}</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setSigningDividend({ id: signingDividend.id, state: "signing" })}>
                    Review and sign agreement
                  </Button>
                </DialogFooter>
              </>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
