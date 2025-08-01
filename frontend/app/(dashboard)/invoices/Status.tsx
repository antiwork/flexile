import { CheckCircleIcon } from "@heroicons/react/16/solid";
import { ClockIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { addDays, isWeekend, nextMonday } from "date-fns";
import React from "react";
import Status, { type Variant } from "@/components/Status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";

type Invoice = Pick<
  RouterOutput["invoices"]["list"][number],
  "status" | "approvals" | "rejector" | "rejectedAt" | "rejectionReason" | "paidAt"
>;
const MID_PAYMENT_INVOICE_STATES: Invoice["status"][] = ["payment_pending", "processing"];

export function StatusDetails({ invoice }: { invoice: Invoice }) {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [{ invoice: consolidatedInvoice }] = trpc.consolidatedInvoices.last.useSuspenseQuery({ companyId: company.id });
  const details = (() => {
    if (invoice.status === "approved" && invoice.approvals.length > 0) {
      return (
        <ul className="list-disc pl-5">
          {invoice.approvals.map((approval, index) => (
            <li key={index}>
              Approved by {approval.approver.id === user.id ? "you" : approval.approver.name} on{" "}
              {formatDate(approval.approvedAt, { time: true })}
            </li>
          ))}
        </ul>
      );
    }
    if (invoice.status === "rejected") {
      let text = "Rejected";
      if (invoice.rejector) text += ` by ${invoice.rejector.name}`;
      if (invoice.rejectedAt) text += ` on ${formatDate(invoice.rejectedAt)}`;
      if (invoice.rejectionReason) text += `: "${invoice.rejectionReason}"`;
      return text;
    }
    if (MID_PAYMENT_INVOICE_STATES.includes(invoice.status) && consolidatedInvoice) {
      let paymentExpectedBy = addDays(consolidatedInvoice.createdAt, company.paymentProcessingDays);
      if (isWeekend(paymentExpectedBy)) paymentExpectedBy = nextMonday(paymentExpectedBy);
      return `Your payment should arrive by ${formatDate(paymentExpectedBy)}`;
    }
    return null;
  })();

  return details ? (
    <Alert className="mx-4" variant={invoice.status === "rejected" ? "destructive" : undefined}>
      <AlertDescription>{details}</AlertDescription>
    </Alert>
  ) : null;
}

export default function InvoiceStatus({ invoice, className }: { invoice: Invoice; className?: string }) {
  const company = useCurrentCompany();
  let variant: Variant;
  let Icon: React.ElementType | undefined;
  let label: string;

  switch (invoice.status) {
    case "received":
    case "approved":
      variant = "primary";
      if (invoice.approvals.length < company.requiredInvoiceApprovals) {
        label = "Awaiting approval";
        if (company.requiredInvoiceApprovals > 1)
          label += ` (${invoice.approvals.length}/${company.requiredInvoiceApprovals})`;
      } else {
        Icon = CheckCircleIcon;
        label = "Approved";
      }
      break;
    case "processing":
      variant = "primary";
      label = "Payment in progress";
      break;
    case "payment_pending":
      variant = "primary";
      Icon = ClockIcon;
      label = "Payment scheduled";
      break;
    case "paid":
      variant = "success";
      Icon = CurrencyDollarIcon;
      label = invoice.paidAt ? `Paid on ${formatDate(invoice.paidAt)}` : "Paid";
      break;
    case "rejected":
      variant = "critical";
      label = "Rejected";
      break;
    case "failed":
      variant = "critical";
      label = "Failed";
      break;
  }

  return (
    <Status variant={variant} className={className} icon={Icon ? <Icon /> : undefined}>
      {label}
    </Status>
  );
}
