import { PencilIcon, PlusIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { getSortedRowModel } from "@tanstack/react-table";
import { useMutation } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import EquityPercentageLockModal from "@/app/invoices/EquityPercentageLockModal";
import { StatusWithTooltip } from "@/app/invoices/Status";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DurationInput from "@/components/DurationInput";
import Input from "@/components/Input";
import MainLayout from "@/components/layouts/Main";
import NumberInput from "@/components/NumberInput";
import RangeInput from "@/components/RangeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import { EquityAllocationStatus, trpc } from "@/trpc/client";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_invoices_path } from "@/utils/routes";
import { formatDate, formatDuration } from "@/utils/time";
import { EDITABLE_INVOICE_STATES } from ".";
import { linkClasses } from "@/components/Link";
import { useRouter } from "next/navigation";

export const useCanSubmitInvoices = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [documents] = trpc.documents.list.useSuspenseQuery({
    companyId: company.id,
    userId: user.id,
    signable: true,
  });
  const unsignedContractId = documents[0]?.id;
  const hasLegalDetails = user.address.street_address;
  return { unsignedContractId, hasLegalDetails, canSubmitInvoices: !unsignedContractId && hasLegalDetails };
};

export default function ViewList() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const router = useRouter();
  const [data, { refetch }] = trpc.invoices.list.useSuspenseQuery({
    contractorId: user.roles.worker?.id,
    companyId: company.id,
  });
  assert(!!user.roles.worker);
  const { unsignedContractId, hasLegalDetails, canSubmitInvoices } = useCanSubmitInvoices();
  const isProjectBased = user.roles.worker.payRateType === "project_based";
  const payRateInSubunits = user.roles.worker.payRateInSubunits;
  const nextInvoiceDate = useMemo(() => new Date(), []);
  const initialInvoiceDate = useMemo(() => formatISO(nextInvoiceDate, { representation: "date" }), [nextInvoiceDate]);
  const [duration, setDuration] = useState<number | null>(null);
  const [amountUsd, setAmountUsd] = useState(payRateInSubunits ? payRateInSubunits / 100 : null);
  const [date, setDate] = useState(initialInvoiceDate);
  const [lockModalOpen, setLockModalOpen] = useState(false);

  const [equityAllocation, { refetch: refetchEquityAllocation }] = trpc.equityAllocations.forYear.useSuspenseQuery({
    companyId: company.id,
    year: nextInvoiceDate.getFullYear(),
  });
  const [invoiceEquityPercent, setInvoiceEquityPercent] = useState(equityAllocation?.equityPercentage ?? 0);

  const noticeMessage =
    equityAllocation?.status === "pending_grant_creation" || equityAllocation?.status === "pending_approval"
      ? "Your allocation is pending board approval. You can submit invoices for this year, but they're only going to be paid once the allocation is approved."
      : equityAllocation?.locked
        ? `You'll be able to select a new allocation for ${new Date().getFullYear() + 1} later this year.`
        : null;

  const totalAmountInCents = useMemo(() => {
    if (isProjectBased) {
      return (amountUsd ?? 0) * 100;
    }
    return Math.ceil(((duration ?? 0) / 60) * (payRateInSubunits ?? 0));
  }, [isProjectBased, amountUsd, duration, payRateInSubunits]);

  const invoiceYear = useMemo(() => new Date(date).getFullYear() || new Date().getFullYear(), [date]);
  const { data: equityCalculation } = trpc.equityCalculations.calculate.useQuery(
    {
      companyId: company.id,
      invoiceYear,
      servicesInCents: totalAmountInCents,
      selectedPercentage: invoiceEquityPercent,
    },
    { enabled: !!duration },
  );

  const { equityAmountCents, cashAmountCents } = useMemo(
    () => ({
      equityAmountCents: equityCalculation?.amountInCents ?? 0,
      cashAmountCents: totalAmountInCents - (equityCalculation?.amountInCents ?? 0),
    }),
    [equityCalculation?.amountInCents, totalAmountInCents],
  );

  const newSearchParams = useMemo(() => {
    const params = new URLSearchParams({ date });
    if (isProjectBased) params.set("amount", String(amountUsd ?? ""));
    else params.set("duration", String(duration ?? ""));
    return params;
  }, [date, isProjectBased, amountUsd, duration]);

  const newCompanyInvoiceRoute = useMemo(() => `/invoices/new?${newSearchParams.toString()}`, [newSearchParams]);

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
        setAmountUsd(payRateInSubunits ? payRateInSubunits / 100 : null);
        setDate(initialInvoiceDate);
        setInvoiceEquityPercent(0);

        await refetch();
      }
    },
  });

  const showLockModal = () => {
    if (totalAmountInCents === 0) return;

    const isAllocationLocked = equityAllocation?.locked ?? false;

    if (!isAllocationLocked && invoiceEquityPercent > 0) {
      setLockModalOpen(true);
    } else {
      submit.mutate();
    }
  };

  const columnHelper = createColumnHelper<(typeof data)[number]>();
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
    [data, isProjectBased],
  );

  const table = useTable({
    columns,
    data,
    initialState: {
      sorting: [{ id: "invoiceDate", desc: true }],
    },
    getSortedRowModel: getSortedRowModel(),
  });
  const quickInvoiceDisabled = !!unsignedContractId || submit.isPending;

  return (
    <MainLayout
      title="Invoicing"
      headerActions={
        !unsignedContractId ? (
          <Button asChild variant="outline" size="small" disabled={!canSubmitInvoices}>
            <Link href="/invoices/new" inert={!canSubmitInvoices}>
              <PlusIcon className="size-4" />
              New invoice
            </Link>
          </Button>
        ) : null
      }
    >
      {!hasLegalDetails ? (
        <Alert>
          <InformationCircleIcon />
          <AlertDescription>
            Please{" "}
            <Link className={linkClasses} href="/settings/tax">
              provide your legal details
            </Link>{" "}
            before creating new invoices.
          </AlertDescription>
        </Alert>
      ) : unsignedContractId ? (
        <Alert>
          <InformationCircleIcon />
          <AlertDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>You have an unsigned contract. Please sign it before creating new invoices.</div>
              <Button asChild variant="outline" size="small">
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

      {noticeMessage && !unsignedContractId ? (
        <Alert>
          <InformationCircleIcon className="size-5" />
          <AlertDescription>{noticeMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* --- Combined Card Layout --- */}
      <Card className={quickInvoiceDisabled ? "pointer-events-none opacity-50" : ""}>
        {/* Main content area with inputs and summary side-by-side on large screens */}
        <CardContent className="p-8">
          <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1fr_auto_1fr]">
            {/* --- Section 1: Inputs --- */}
            <div className="grid gap-6">
              <div className="grid grid-cols-1 gap-6">
                {isProjectBased ? (
                  <div className="grid gap-2">
                    <Label htmlFor="amount-to-bill">Amount to bill</Label>
                    <NumberInput
                      id="amount-to-bill"
                      value={amountUsd}
                      onChange={setAmountUsd}
                      min={0.01}
                      step={0.01}
                      placeholder={payRateInSubunits ? String(payRateInSubunits / 100) : undefined}
                      prefix="$"
                      disabled={quickInvoiceDisabled}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="quick-invoice-hours">Hours worked</Label>
                    <DurationInput
                      id="quick-invoice-hours"
                      value={duration}
                      onChange={setDuration}
                      disabled={quickInvoiceDisabled}
                      placeholder="HH:MM"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="quick-invoice-date">Invoice date</Label>
                  <Input
                    id="quick-invoice-date"
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      void refetchEquityAllocation();
                    }}
                    type="date"
                    disabled={quickInvoiceDisabled}
                  />
                </div>
              </div>

              {company.equityCompensationEnabled ? (
                <div className="grid gap-2">
                  <RangeInput
                    value={invoiceEquityPercent}
                    onChange={setInvoiceEquityPercent}
                    min={0}
                    max={MAX_EQUITY_PERCENTAGE}
                    ariaLabel="Cash vs equity split"
                    unit="%"
                    disabled={quickInvoiceDisabled}
                    label={
                      <div className="flex justify-between gap-2">
                        <span>How much of your rate would you like to swap for equity?</span>
                        <a
                          className="text-gray-400 underline hover:text-gray-600"
                          href="https://sahillavingia.com/dividends"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Learn more
                        </a>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>

            {/* --- Horizontal Separator (mobile only) --- */}
            <Separator orientation="horizontal" className="block w-full lg:hidden" />

            {/* --- Vertical Separator (lg screens only) --- */}
            <Separator orientation="vertical" className="hidden lg:block" />

            {/* --- Section 2: Summary --- */}
            <div className="grid gap-2">
              {/* Rate Breakdown */}
              {!isProjectBased && (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-sm">Cash amount</span>
                    <span className="text-sm">
                      {formatMoneyFromCents(cashAmountCents)} <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                  <div className="flex justify-between gap-2">
                    <span className="text-sm">Equity value</span>
                    <span className="text-sm">
                      {formatMoneyFromCents(equityAmountCents)} <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                  <div className="flex justify-between gap-2">
                    <span className="text-sm">Total rate</span>
                    <span className="text-sm">
                      {formatMoneyFromCents(cashAmountCents + equityAmountCents)}
                      <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                </>
              )}

              {/* Invoice Total */}
              <div className="mt-2 mb-2 pt-2 text-right lg:mt-16 lg:mb-3 lg:pt-0">
                <span className="text-sm text-gray-500">Total amount</span>
                <div className="text-3xl font-bold">{formatMoneyFromCents(totalAmountInCents)}</div>
                {invoiceEquityPercent > 0 && (
                  <div className="mt-1 text-sm text-gray-500">
                    ({formatMoneyFromCents(cashAmountCents)} cash + {formatMoneyFromCents(equityAmountCents)} equity)
                  </div>
                )}
              </div>
              {/* Right side: Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" className="grow sm:grow-0" asChild>
                  <a inert={quickInvoiceDisabled} href={`${newCompanyInvoiceRoute}&expenses=true`}>
                    Add more info
                  </a>
                </Button>
                <Button
                  disabled={quickInvoiceDisabled || totalAmountInCents <= 0}
                  className="grow sm:grow-0"
                  onClick={showLockModal}
                >
                  {submit.isPending ? "Sending..." : "Send for approval"}{" "}
                </Button>
                {company.equityCompensationEnabled &&
                (!equityAllocation || equityAllocation.status === EquityAllocationStatus.PendingConfirmation) ? (
                  <EquityPercentageLockModal
                    open={lockModalOpen}
                    onClose={() => setLockModalOpen(false)}
                    percentage={invoiceEquityPercent}
                    year={invoiceYear}
                    onComplete={submit.mutate}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {data.length > 0 ? <DataTable table={table} onRowClicked={(row) => router.push(`/invoices/${row.id}`)} /> : null}
    </MainLayout>
  );
}
