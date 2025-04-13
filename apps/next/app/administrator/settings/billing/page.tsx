"use client";

import { ArrowDownTrayIcon, ArrowPathIcon, CurrencyDollarIcon } from "@heroicons/react/16/solid";
import { DocumentCurrencyDollarIcon } from "@heroicons/react/24/solid";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
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
  columnHelper.accessor("receiptUrl", {
    id: "actions",
    header: "",
    cell: (info) => {
      const receiptUrl = info.getValue();
      return receiptUrl ? (
        <Button asChild variant="outline" size="small">
          <a href={receiptUrl} download>
            <ArrowDownTrayIcon className="size-4" /> Download
          </a>
        </Button>
      ) : null;
    },
  }),
];

export default function Billing() {
  const company = useCurrentCompany();
  const [data] = trpc.consolidatedInvoices.list.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns, data });

  return data.length > 0 ? (
    <Table table={table} />
  ) : (
    <Placeholder icon={DocumentCurrencyDollarIcon}>Invoices will appear here.</Placeholder>
  );
}
