"use client";

import { ArrowDownTrayIcon, ArrowPathIcon, CurrencyDollarIcon } from "@heroicons/react/16/solid";
import { DocumentCurrencyDollarIcon } from "@heroicons/react/24/solid";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { request } from "@/utils/request";
import { loadStripe } from "@stripe/stripe-js";
import env from "@/env/client";
import { z } from "zod";
import { company_administrator_settings_bank_accounts_path } from "@/utils/routes";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import StripeMicrodepositVerification from "@/app/administrator/settings/StripeMicrodepositVerification";

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
          <Status variant="success" icon={<CurrencyDollarIcon />}>
            Paid
          </Status>
        );
      case "refunded":
        return (
          <Status variant="success" icon={<ArrowPathIcon />}>
            Refunded
          </Status>
        );
      case "failed":
        return (
          <Status variant="critical" icon={<ArrowPathIcon />}>
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
            <ArrowDownTrayIcon className="size-4" /> Download
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
    ".Input": { border: "1px solid rgba(83, 87, 83, 0.9)" },
    ".Input:hover": { borderColor: "rgba(4, 5, 0, 0.9)" },
    ".Input:focus": { borderColor: "rgba(4, 5, 0, 0.9)", outline: "2px rgba(214, 233, 255, 1)" },
    ".Input--invalid": { borderColor: "var(--colorDanger)" },
    ".PickerItem": { border: "1px solid rgba(83, 87, 83, 0.9)", padding: "var(--fontSize2Xl)" },
    ".MenuIcon:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".MenuAction": { backgroundColor: "#f7f9fa" },
    ".MenuAction:hover": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".Dropdown": { border: "1px solid rgba(83, 87, 83, 0.9)" },
    ".DropdownItem": { padding: "var(--fontSizeLg)" },
    ".DropdownItem--highlight": { backgroundColor: "rgba(240, 247, 255, 1)" },
    ".TermsText": { fontSize: "var(--fontSizeBase)" },
  },
};

const stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
export default function Billing() {
  const company = useCurrentCompany();
  const { data: stripeData } = useSuspenseQuery({
    queryKey: ["administratorBankAccount", company.id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: company_administrator_settings_bank_accounts_path(company.id),
        accept: "json",
        assertOk: true,
      });
      return z.object({ client_secret: z.string(), setup_intent_status: z.string() }).parse(await response.json());
    },
  });
  const [data] = trpc.consolidatedInvoices.list.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns, data });

  return (
    <div className="grid gap-4">
      {stripeData.setup_intent_status === "succeeded" ? null : (
        <Elements
          stripe={stripePromise}
          options={{ appearance: stripeAppearance, clientSecret: stripeData.client_secret }}
        >
          <AddBankAccount />
        </Elements>
      )}
      <StripeMicrodepositVerification />
      <Alert>
        <InformationCircleIcon />
        <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
        <AlertDescription>
          Want faster payments? Email us at <a href="mailto:support@flexile.com">support@flexile.com</a> to complete
          additional verification steps.
        </AlertDescription>
      </Alert>
      {data.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <Placeholder icon={DocumentCurrencyDollarIcon}>Invoices will appear here.</Placeholder>
      )}
    </div>
  );
}

const AddBankAccount = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const trpcUtils = trpc.useUtils();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) return;
      const { error } = await stripe.confirmSetup({
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
        accept: "json",
        assertOk: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["administratorBankAccount", company.id] });
      await trpcUtils.companies.microdepositVerificationDetails.invalidate();
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Alert>
        <InformationCircleIcon />
        <AlertTitle>You currently do not have a bank account linked.</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p>We'll use this account to debit contractor payments and our monthly fee.</p>
            <p>You won't be charged until the first payment.</p>
          </div>
          <DialogTrigger asChild>
            <Button>Link your bank account</Button>
          </DialogTrigger>
        </AlertDescription>
      </Alert>
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
