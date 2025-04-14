import { CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, PlusIcon } from "@heroicons/react/20/solid";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import EquityPercentageLockModal from "@/app/invoices/EquityPercentageLockModal";
import { StatusWithTooltip } from "@/app/invoices/Status";
import { Card, CardRow } from "@/components/Card";
import DecimalInput from "@/components/DecimalInput";
import DurationInput from "@/components/DurationInput";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import { linkClasses } from "@/components/Link";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_invoices_path } from "@/utils/routes";
import { formatDate, formatDuration } from "@/utils/time";
import { EDITABLE_INVOICE_STATES } from ".";

const useData = () => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [page] = usePage();
  return trpc.invoices.list.useSuspenseQuery({
    contractorId: user.roles.worker?.id,
    companyId: company.id,
    perPage,
    page,
  });
};

const perPage = 50;
export default function ViewList() {
  const [data] = useData();
  const router = useRouter();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  assert(!!user.roles.worker);
  const isProjectBased = user.roles.worker.payRateType === "project_based";
  const [documents] = trpc.documents.list.useSuspenseQuery({
    companyId: company.id,
    userId: user.id,
    signable: true,
  });
  const unsignedContractId = documents.documents[0]?.id;
  const columnHelper = createColumnHelper<(typeof data.invoices)[number]>();
  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("invoiceNumber", {
          header: "Invoice ID",
          cell: (info) => (
            <Link href={`/invoices/${info.row.original.id}`} className="no-underline">
              {info.getValue()}
            </Link>
          ),
        }),
        columnHelper.simple("invoiceDate", "Sent on", (value) => (value ? formatDate(value) : "N/A")),
        isProjectBased
          ? null
          : columnHelper.simple("totalMinutes", "Hours", (v) => (v ? formatDuration(v) : "N/A"), "numeric"),
        columnHelper.simple("totalAmountInUsdCents", "Amount", (v) => formatMoneyFromCents(v), "numeric"),
        columnHelper.accessor("status", {
          header: "Status",
          cell: (info) => <StatusWithTooltip invoice={info.row.original} />,
        }),
        columnHelper.display({
          id: "actions",
          cell: (info) => {
            const invoice = info.row.original;
            return EDITABLE_INVOICE_STATES.includes(invoice.status) ? (
              <a href={`/invoices/${invoice.id}/edit`} aria-label="Edit">
                <PencilIcon className="size-4" />
              </a>
            ) : null;
          },
        }),
      ].filter((column) => !!column),
    [data],
  );

  const table = useTable({ columns, data: data.invoices });

  return (
    <MainLayout
      title="Invoicing"
      headerActions={
        !unsignedContractId ? (
          <Button asChild variant="outline" size="small">
            <Link href="/invoices/new">
              <PlusIcon className="size-4" />
              New invoice
            </Link>
          </Button>
        ) : null
      }
    >
      {unsignedContractId ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>You have an unsigned contract. Please sign it before creating new invoices.</div>
              <Button asChild variant="outline" size="small" disabled={!!unsignedContractId}>
                <Link
                  href={`/documents?${new URLSearchParams({ sign: unsignedContractId.toString(), next: "/invoices" })}`}
                >
                  Review & sign
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <QuickInvoiceSection disabled={!!unsignedContractId} />

      {data.invoices.length > 0 ? (
        <>
          <Table table={table} onRowClicked={(row) => router.push(`/invoices/${row.id}`)} />
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <div>
          <Placeholder icon={CurrencyDollarIcon}>
            Create a new invoice to get started.
            <Button asChild variant="outline" size="small" disabled={!!unsignedContractId}>
              <a inert={!!unsignedContractId} href="/invoices/new">
                <PlusIcon className="size-4" />
                New invoice
              </a>
            </Button>
          </Placeholder>
        </div>
      )}
    </MainLayout>
  );
}

const QuickInvoiceSection = ({ disabled }: { disabled?: boolean }) => {
  const [_, { refetch }] = useData();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  assert(!!user.roles.worker);
  const nextInvoiceDate = new Date();
  const isProjectBased = user.roles.worker.payRateType === "project_based";

  const [equityAllocation] = trpc.equityAllocations.forYear.useSuspenseQuery({
    companyId: company.id,
    year: nextInvoiceDate.getFullYear(),
  });
  assert(!!user.roles.worker);
  const payRateInSubunits = user.roles.worker.payRateInSubunits;
  const initialInvoiceDate = formatISO(nextInvoiceDate, { representation: "date" });

  const [duration, setDuration] = useState<number | null>(null);
  const [amountUsd, setAmountUsd] = useState<number | null>(payRateInSubunits ? payRateInSubunits / 100 : null);
  const [date, setDate] = useState(initialInvoiceDate);
  const [lockModalOpen, setLockModalOpen] = useState(false);

  const totalAmountInCents = isProjectBased
    ? (amountUsd ?? 0) * 100
    : Math.ceil(((duration ?? 0) / 60) * (payRateInSubunits ?? 0));

  const invoiceYear = new Date(date).getFullYear() || new Date().getFullYear();

  const newSearchParams = new URLSearchParams({ date });
  if (isProjectBased) newSearchParams.set("amount", String(amountUsd));
  else newSearchParams.set("duration", String(duration));
  const newCompanyInvoiceRoute = `/invoices/new?${newSearchParams.toString()}`;

  const showLockModal = () => {
    if (totalAmountInCents === 0) return;

    if (equityCalculation.isEquityAllocationLocked === false && equityCalculation.selectedPercentage != null) {
      setLockModalOpen(true);
    } else {
      submit.mutate();
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      setLockModalOpen(false);

      const response = await request({
        method: "POST",
        url: company_invoices_path(company.id),
        accept: "json",
        jsonData: {
          invoice: { invoice_date: date },
          invoice_line_items: [
            isProjectBased
              ? { description: "Project work", total_amount_cents: totalAmountInCents }
              : { description: "Hours worked", minutes: duration },
          ],
        },
      });

      if (response.ok) {
        setDuration(null);
        setAmountUsd(null);
        setDate(initialInvoiceDate);

        await refetch();
      }
    },
  });

  const [equityCalculation] = trpc.equityCalculations.calculate.useSuspenseQuery({
    companyId: company.id,
    servicesInCents: totalAmountInCents,
    invoiceYear,
  });

  return (
    <Card disabled={!!disabled}>
      <CardRow className="grid gap-4">
        <h4 className="text-sm uppercase">Quick invoice</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            {isProjectBased ? (
              <DecimalInput
                value={amountUsd}
                onChange={setAmountUsd}
                label="Amount to bill"
                min={1}
                step={0.01}
                placeholder={payRateInSubunits ? String(payRateInSubunits / 100) : undefined}
                prefix="$"
                disabled={submit.isPending}
              />
            ) : (
              <DurationInput value={duration} onChange={setDuration} label="Hours worked" disabled={submit.isPending} />
            )}
            {equityAllocation !== null &&
            equityCalculation.selectedPercentage == null &&
            !user.roles.worker.onTrial &&
            !isProjectBased ? (
              <Link href="/settings/equity" className={linkClasses}>
                Swap some cash for equity
              </Link>
            ) : equityCalculation.amountInCents > 0 ? (
              <div className="text-xs">Total invoice amount: {formatMoneyFromCents(totalAmountInCents)}</div>
            ) : null}
          </div>
          <div>
            <Input value={date} onChange={setDate} label="Invoice date" type="date" disabled={submit.isPending} />
          </div>
          <div className="text-right">
            <span>{equityCalculation.amountInCents > 0 ? "Net amount in cash" : "Total to invoice"}</span>
            <div className="text-3xl font-bold">
              {formatMoneyFromCents(totalAmountInCents - equityCalculation.amountInCents)}
            </div>
            {equityCalculation.amountInCents > 0 ? (
              <div className="text-xs">
                Swapped for equity (not paid in cash): {formatMoneyFromCents(equityCalculation.amountInCents)}
              </div>
            ) : null}
          </div>
        </div>
      </CardRow>

      <CardRow className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {company.flags.includes("expenses") ? (
            <a href={`${newCompanyInvoiceRoute}&expenses=true`} inert={submit.isPending} className={linkClasses}>
              <CurrencyDollarIcon className="inline size-4" /> Add expenses
            </a>
          ) : null}
          <a href={newCompanyInvoiceRoute} inert={submit.isPending} className={linkClasses}>
            <ChatBubbleLeftIcon className="inline size-4" /> Add notes
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" className="grow" asChild>
            <a inert={submit.isPending} href={newCompanyInvoiceRoute} className={linkClasses}>
              Preview
            </a>
          </Button>
          <Button disabled={submit.isPending} className="grow" onClick={showLockModal}>
            Send for approval
          </Button>
          {equityCalculation.selectedPercentage != null ? (
            <EquityPercentageLockModal
              open={lockModalOpen}
              onClose={() => setLockModalOpen(false)}
              percentage={equityCalculation.selectedPercentage}
              year={invoiceYear}
              onComplete={submit.mutate}
            />
          ) : null}
        </div>
      </CardRow>
    </Card>
  );
};
