"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Download, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { z } from "zod";
import StripeMicrodepositVerification from "@/app/settings/administrator/StripeMicrodepositVerification";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import env from "@/env/client";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_administrator_settings_bank_accounts_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

const columnHelper = createColumnHelper<RouterOutput["consolidatedInvoices"]["list"][number]>();
const columns = [
  columnHelper.simple("invoiceDate", "Date", formatDate),
  columnHelper.simple("totalContractors", "Contractors", (v) => v.toLocaleString(), "numeric"),
  columnHelper.simple("totalCents", "Invoice total", (v) => formatMoneyFromCents(v), "numeric"),
  columnHelper.simple("status", "Status", (status) => {
    switch (status.toLowerCase()) {
      case "sent":
        return <Status variant="primary">Sent</Status>;
      case "processing":
        return <Status variant="primary">Payment in progress</Status>;
      case "paid":
        return (
          <Status variant="success" icon={<CircleDollarSign />}>
            Paid
          </Status>
        );
      case "refunded":
        return (
          <Status variant="success" icon={<RefreshCw />}>
            Refunded
          </Status>
        );
      case "failed":
        return (
          <Status variant="critical" icon={<RefreshCw />}>
            Failed
          </Status>
        );
    }
  }),
  columnHelper.accessor("attachment", {
    id: "actions",
    header: "",
    cell: (info) => {
      const attachment = info.getValue();
      return attachment ? (
        <Button asChild variant="outline" size="small">
          <Link href={`/download/${attachment.key}/${attachment.filename}`} download>
            <Download className="size-4" /> Download
          </Link>
        </Button>
      ) : null;
    },
  }),
];

const stripeAppearance = {
  variables: {
    colorPrimary: "rgba(83, 87, 83, 0.9)",
    colorBackground: "#ffffff",
    colorText: "rgba(4, 5, 0, 0.9)",
    colorDanger: "rgba(219, 53, 0, 1)",
    fontFamily: "ABC Whyte, sans-serif",
    spacingUnit: "4px",
    borderRadius: "4px",
    fontWeightMedium: "500",
    fontSizeBase: "0.875rem",
    colorIcon: "rgba(83, 87, 83, 0.9)",
  },
  rules: {
    ".Link:hover": { textDecoration: "underline" },
    ".Label": { color: "rgba(83, 87, 83, 0.9)" },
    ".Input": { border: "1px solid rgb(214, 214, 214)", boxShadow: "none" },
    ".Input:hover": { borderColor: "rgba(4, 5, 0, 0.9)" },
    ".Input:focus": { borderColor: "rgba(4, 5, 0, 0.9)", outline: "2px rgba(214, 233, 255, 1)" },
    ".Input--invalid": { borderColor: "var(--colorDanger)" },
    ".PickerItem": { border: "1px solid rgb(214, 214, 214)", boxShadow: "none", padding: "var(--fontSize2Xl)" },
    ".MenuIcon:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".MenuAction": { backgroundColor: "#f7f9fa" },
    ".MenuAction:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".Dropdown": { border: "1px solid rgba(83, 87, 83, 0.9)" },
    ".DropdownItem": { padding: "var(--fontSizeLg)" },
    ".DropdownItem--highlight": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".TermsText": { fontSize: "var(--fontSizeBase)" },
    ".p-AccordionPanelContents": { padding: "0" },
    ".AccordionItem": { border: "none", padding: "2px", boxShadow: "none" },
  },
};

const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
export default function Billing() {
  const company = useCurrentCompany();
  const [addingBankAccount, setAddingBankAccount] = useState(false);
  const { data: stripeData } = useQuery({
    queryKey: ["administratorBankAccount", company.id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: company_administrator_settings_bank_accounts_path(company.id),
        accept: "json",
        assertOk: true,
      });
      return z
        .object({ client_secret: z.string(), bank_account_last4: z.string().nullable() })
        .parse(await response.json());
    },
  });
  const { data, isLoading } = trpc.consolidatedInvoices.list.useQuery({ companyId: company.id });

  return (
    <div className="grid gap-4">
      <h2 className="mb-8 text-xl font-medium">Billing</h2>
      <hgroup>
        <h3 className="mb-1 text-base font-medium">Payout method</h3>
        <p className="text-muted-foreground text-sm">
          Each month, the selected bank account will be debited for the combined total of approved invoices and Flexile
          fees.
        </p>
      </hgroup>

      {stripeData !== undefined ? (
        // Re-render Stripe Elements provider when data changes as it considers its options immutable
        <>
          {stripeData.bank_account_last4 ? (
            <Card>
              <CardHeader>
                <CardTitle>USD bank account</CardTitle>
                <CardDescription>Ending in {stripeData.bank_account_last4}</CardDescription>
                <CardAction>
                  <Button variant="outline" onClick={() => setAddingBankAccount(true)}>
                    Edit
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          ) : (
            <Placeholder icon={CircleDollarSign}>
              <p>We'll use this account to debit contractor payments and our monthly fee.</p>
              <Button onClick={() => setAddingBankAccount(true)}>
                <Plus className="size-4" />
                Link your bank account
              </Button>
            </Placeholder>
          )}
          <Elements
            stripe={stripePromise}
            options={{ appearance: stripeAppearance, clientSecret: stripeData.client_secret }}
          >
            <AddBankAccount open={addingBankAccount} onOpenChange={setAddingBankAccount} />
          </Elements>
        </>
      ) : (
        <BankAccountCardSkeleton />
      )}
      <StripeMicrodepositVerification />
      <h3 className="mt-4 text-base font-medium">Billing history</h3>
      <Alert>
        <InformationCircleIcon />
        <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
        <AlertDescription>
          Want faster payments? Email us at <a href="mailto:support@flexile.com">support@flexile.com</a> to complete
          additional verification steps.
        </AlertDescription>
      </Alert>
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : data && data.length > 0 ? (
        <DataTable table={useTable({ columns, data })} />
      ) : (
        <Placeholder icon={CircleDollarSign}>Invoices will appear here.</Placeholder>
      )}
    </div>
  );
}

const AddBankAccount = (props: React.ComponentProps<typeof Dialog>) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const trpcUtils = trpc.useUtils();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) return;
      const { setupIntent, error } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          payment_method_data: {
            billing_details: { name: company.name, email: user.email },
          },
        },
      });

      if (error) throw error;
      await request({
        method: "POST",
        url: company_administrator_settings_bank_accounts_path(company.id),
        jsonData: { setup_intent_id: setupIntent.id },
        accept: "json",
        assertOk: true,
      });
      await queryClient.resetQueries({ queryKey: ["administratorBankAccount", company.id] });
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      await trpcUtils.companies.microdepositVerificationDetails.invalidate();
      props.onOpenChange?.(false);
    },
  });

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogTitle>Link your bank account</DialogTitle>
        <PaymentElement
          options={{ fields: { billingDetails: { name: "never", email: "never" } } }}
          onChange={(e) => {
            if (e.complete) saveMutation.mutate();
          }}
        />
        {saveMutation.error ? <div>{saveMutation.error.message}</div> : null}
      </DialogContent>
    </Dialog>
  );
};

function BankAccountCardSkeleton() {
  return (
    <div className="border-gray-40 rounded-md p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-5 w-40 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-8 w-16 rounded" />
      </div>
    </div>
  );
}
