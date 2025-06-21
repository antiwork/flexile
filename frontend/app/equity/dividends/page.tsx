"use client";
import { CircleCheck, Info } from "lucide-react";
import React, { useMemo, useState } from "react";
import DividendStatusIndicator from "@/app/equity/DividendStatusIndicator";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { linkClasses } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { request } from "@/utils/request";
import { company_dividend_path, sign_company_dividend_path } from "@/utils/routes";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import RichText from "@/components/RichText";
import MutationButton from "@/components/MutationButton";

type Dividend = RouterOutput["dividends"]["list"][number];
const columnHelper = createColumnHelper<Dividend>();
export default function Dividends() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data, { refetch }] = trpc.dividends.list.useSuspenseQuery({
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
              cumulative_return: z.number(),
              withheld_tax_cents: z.number(),
              bank_account_last_4: z.string(),
              release_agreement: z.string(),
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

  const columns = useMemo(
    () => [
      columnHelper.simple("dividendRound.issuedAt", "Issue date", formatDate),
      columnHelper.simple("numberOfShares", "Shares", (value) => value?.toLocaleString() ?? "N/A", "numeric"),
      columnHelper.simple("totalAmountInCents", "Amount", (value) => formatMoneyFromCents(value), "numeric"),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const user = useCurrentUser();
          return (
            <div className="flex justify-between gap-2">
              <DividendStatusIndicator dividend={info.row.original} />
              {info.row.original.investor.user.id === user.id && (
                <Button onClick={() => setSigningDividend({ id: info.row.original.id, state: "initial" })}>Sign</Button>
              )}
            </div>
          );
        },
      }),
    ],
    [],
  );
  const table = useTable({ columns, data });

  return (
    <EquityLayout>
      {user.hasPayoutMethod ? null : (
        <Alert>
          <Info />
          <AlertDescription>
            Please{" "}
            <Link className={linkClasses} href="/settings/payouts">
              provide a payout method
            </Link>{" "}
            for your dividends.
          </AlertDescription>
        </Alert>
      )}
      {data.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <Placeholder icon={CircleCheck}>You have not been issued any dividends yet.</Placeholder>
      )}
      <Dialog open={!!dividendData} onOpenChange={() => setSigningDividend(null)}>
        <DialogContent>
          {dividendData && signingDividend ? (
            signingDividend.state !== "initial" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Release agreement</DialogTitle>
                  Please review and sign this agreement to receive your payout. This document outlines the terms and
                  conditions for the return of capital.
                </DialogHeader>
                <div className="prose max-h-100 overflow-y-auto border">
                  <RichText
                    content={dividendData.release_agreement
                      .replaceAll("{{investor}}", user.name)
                      .replaceAll("{{amount}}", formatMoneyFromCents(dividendData.total_amount_in_cents))}
                  />
                </div>
                <div className="flex justify-between gap-2 py-2">
                  <h3 className="font-medium">Your signature</h3>
                  {signingDividend.state === "signing" ? (
                    <>
                      <Button className="w-full" variant="dashed">
                        Add your signature
                      </Button>
                      <div className="text-muted-foreground text-xs">
                        By clicking the button above, you agree to using an electronic representation of your signature
                        for all purposes within Flexile, just the same as a pen-and-paper signature.
                      </div>
                    </>
                  ) : (
                    <div className="font-signature text-lg">{user.name}</div>
                  )}
                </div>
                <DialogFooter>
                  <MutationButton mutation={signDividend}>Accept funds</MutationButton>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Dividend details</DialogTitle>
                </DialogHeader>
                <Card className="mb-6">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="bg-muted">
                      <AvatarImage asChild>
                        <Image
                          src={company.logo_url ?? "/images/default-company-logo.svg"}
                          alt=""
                          width={40}
                          height={40}
                        />
                      </AvatarImage>
                    </Avatar>
                    <div className="flex-1">
                      <div className="muted-foreground text-xs">{company.name}</div>
                      <div className="font-semibold">Return of capital</div>
                    </div>
                    <div className="font-semibold">{formatMoneyFromCents(dividendData.total_amount_in_cents)}</div>
                  </CardContent>
                </Card>
                <div className="flex justify-between gap-2 py-2">
                  <h3 className="font-medium">Cumulative return</h3>
                  <span>{(dividendData.cumulative_return / 100).toLocaleString([], { style: "percent" })}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2 py-2">
                  <h3 className="font-medium">Taxes withheld</h3>
                  <span>{formatMoneyFromCents(dividendData.withheld_tax_cents)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2 py-2">
                  <h3 className="font-medium">Payout method</h3>
                  <span>Account ending in {dividendData.bank_account_last_4}</span>
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
    </EquityLayout>
  );
}
