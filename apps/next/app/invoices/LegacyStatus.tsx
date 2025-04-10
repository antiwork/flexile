import { CheckCircleIcon } from "@heroicons/react/16/solid";
import { ClockIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import React from "react";
import { z } from "zod";
import Status, { type Variant } from "@/components/Status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { formatDate } from "@/utils/time";

export const invoiceSchema = z.object({
  status: z.enum(["received", "approved", "processing", "payment_pending", "paid", "rejected", "failed"]),
  paid_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  rejected_at: z.string().nullable(),
  rejected_by: z.string().nullable(),
  payment_expected_by: z.string().nullable(),
  invoice_approvals: z.array(z.object({ approver: z.string(), approved_at: z.string() })),
  required_approvals_count: z.number(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  title: z.string(),
  url: z.string(),
});
type Invoice = z.infer<typeof invoiceSchema>;

const MID_PAYMENT_INVOICE_STATES: Invoice["status"][] = ["payment_pending", "processing"];

export function StatusDetails(invoice: Invoice) {
  if (invoice.status === "approved" && invoice.invoice_approvals.length > 0) {
    return (
      <ul className="list-disc pl-5">
        {invoice.invoice_approvals.map((approval, index) => (
          <li key={index}>
            Approved by {approval.approver} on {formatDate(approval.approved_at, { time: true })}
          </li>
        ))}
      </ul>
    );
  }
  if (invoice.status === "rejected") {
    let text = "Rejected";
    if (invoice.rejected_by) text += ` by ${invoice.rejected_by}`;
    if (invoice.rejected_at) text += ` on ${formatDate(invoice.rejected_at)}`;
    if (invoice.rejection_reason) text += `: "${invoice.rejection_reason}"`;
    return text;
  }
  if (MID_PAYMENT_INVOICE_STATES.includes(invoice.status) && invoice.payment_expected_by) {
    return `Your payment should arrive by ${formatDate(invoice.payment_expected_by)}`;
  }
  return null;
}

export default function InvoiceStatus({ invoice, className }: { invoice: Invoice; className?: string }) {
  let variant: Variant;
  let Icon: React.ElementType | undefined;
  let label: string;

  switch (invoice.status) {
    case "received":
    case "approved":
      variant = "primary";
      if (invoice.invoice_approvals.length < invoice.required_approvals_count) {
        label = "Awaiting approval";
        if (invoice.required_approvals_count > 1)
          label += ` (${invoice.invoice_approvals.length}/${invoice.required_approvals_count})`;
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
      label = invoice.paid_at ? `Paid on ${formatDate(invoice.paid_at)}` : "Paid";
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

export const StatusWithTooltip = ({ invoice }: { invoice: Invoice }) => {
  const details = StatusDetails(invoice);

  return (
    <Tooltip>
      <TooltipTrigger>
        <InvoiceStatus invoice={invoice} />
      </TooltipTrigger>
      <TooltipContent>{details}</TooltipContent>
    </Tooltip>
  );
};
