"use client";

import { Download, AlertTriangle, CircleCheck, Info, Pencil, Plus } from "lucide-react";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import Link from "next/link";
import React, { Fragment, useEffect, useMemo, useState, Suspense } from "react";
import StripeMicrodepositVerification from "@/app/administrator/settings/StripeMicrodepositVerification";
import {
  ApproveButton,
  EDITABLE_INVOICE_STATES,
  RejectModal,
  useApproveInvoices,
  useAreTaxRequirementsMet,
  useIsActionable,
  useIsPayable,
} from "@/app/invoices/index";
import { StatusWithTooltip } from "@/app/invoices/Status";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";
import { company_invoices_path, export_company_invoices_path } from "@/utils/routes";
import { formatDate, formatDuration } from "@/utils/time";
import NumberInput from "@/components/NumberInput";
import DurationInput from "@/components/DurationInput";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import RangeInput from "@/components/RangeInput";
import { useMutation } from "@tanstack/react-query";
import { request } from "@/utils/request";
import EquityPercentageLockModal from "./EquityPercentageLockModal";
import { useCanSubmitInvoices } from ".";
import { linkClasses } from "@/components/Link";
import DatePicker from "@/components/DatePicker";
import { CalendarDate, today, getLocalTimeZone } from "@internationalized/date";
import { zodResolver } from "@hookform/resolvers/zod";
import { InvoiceTableSkeleton } from "@/components/skeletons/InvoiceTableSkeleton";
import { QuickInvoiceSkeleton } from "@/components/skeletons/QuickInvoiceSkeleton";
import { AlertSkeleton, AlertWithTitleSkeleton } from "@/components/skeletons/AlertSkeleton";

const statusNames = {
  received: "Awaiting approval",
  approved: "Awaiting approval",
  processing: "Processing",
  payment_pending: "Processing",
  paid: "Paid",
  rejected: "Rejected",
  failed: "Failed",
};

type Invoice = RouterOutput["invoices"]["list"][number];

function InvoicesContent() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [openModal, setOpenModal] = useState<"approve" | "reject" | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const isActionable = useIsActionable();
  const isPayable = useIsPayable();
  const areTaxRequirementsMet = useAreTaxRequirementsMet();
  const { data, isLoading } = trpc.invoices.list.useQuery({
    companyId: company.id,
    contractorId: user.roles.administrator ? undefined : user.roles.worker?.id,
  });

  if (isLoading || !data) {
    return <InvoicesPageSkeleton />;
  }

  const { canSubmitInvoices, hasLegalDetails, unsignedContractId } = useCanSubmitInvoices();

  const approveInvoices = useApproveInvoices(() => {
    setOpenModal(null);
    table.resetRowSelection();
  });

  const columnHelper = createColumnHelper<(typeof data)[number]>();
  const columns = useMemo(
    () => [
      user.roles.administrator
        ? columnHelper.accessor("billFrom", {
            header: "Contractor",
            cell: (info) => (
              <>
                <b className="truncate">{info.getValue()}</b>
                <div className="text-xs text-gray-500">{info.row.original.contractor.role}</div>
              </>
            ),
          })
        : columnHelper.accessor("invoiceNumber", {
            header: "Invoice ID",
            cell: (info) => (
              <Link href={`/invoices/${info.row.original.id}`} className="no-underline after:absolute after:inset-0">
                {info.getValue()}
              </Link>
            ),
          }),
      columnHelper.simple("invoiceDate", "Sent on", (value) => (value ? formatDate(value) : "N/A")),
      columnHelper.simple("totalMinutes", "Hours", (value) => (value ? formatDuration(value) : "N/A"), "numeric"),
      columnHelper.simple(
        "totalAmountInUsdCents",
        "Amount",
        (value) => (value ? formatMoneyFromCents(value) : "N/A"),
        "numeric",
      ),
      columnHelper.accessor((row) => statusNames[row.status], {
        header: "Status",
        cell: (info) => (
          <div className="relative z-1">
            <StatusWithTooltip invoice={info.row.original} />
          </div>
        ),
        meta: {
          filterOptions: Array.from(new Set(data.map((invoice) => statusNames[invoice.status]))),
        },
      }),
      columnHelper.accessor(isActionable, {
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const invoice = info.row.original;
          return (
            <>
              {invoice.contractor.user.id === user.id && EDITABLE_INVOICE_STATES.includes(invoice.status) ? (
                <Link href={`/invoices/${invoice.id}/edit`} aria-label="Edit">
                  <Pencil className="size-4" />
                </Link>
              ) : null}
              {user.roles.administrator && isActionable(invoice) ? <ApproveButton invoice={invoice} /> : null}
            </>
          );
        },
      }),
    ],
    [],
  );

  const table = useTable({
    columns,
    data,
    getRowId: (invoice) => invoice.id,
    initialState: {
      sorting: [{ id: user.roles.administrator ? "actions" : "invoiceDate", desc: true }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    enableGlobalFilter: !!user.roles.administrator,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedInvoices = selectedRows.map((row) => row.original);
  const selectedApprovableInvoices = selectedInvoices.filter(isActionable);
  const selectedPayableInvoices = selectedApprovableInvoices.filter(isPayable);

  let workerNotice = null;
  if (user.roles.worker) {
    if (!hasLegalDetails) {
      workerNotice = (
        <>
          Please{" "}
          <Link className={linkClasses} href="/settings/tax">
            provide your legal details
          </Link>{" "}
          before creating new invoices.
        </>
      );
    } else if (unsignedContractId) {
      workerNotice = (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>You have an unsigned contract. Please sign it before creating new invoices.</div>
          <Button asChild variant="outline" size="small">
            <Link href="/documents">Review & sign</Link>
          </Button>
        </div>
      );
    } else if (!user.hasPayoutMethod) {
      workerNotice = (
        <>
          Please{" "}
          <Link className={linkClasses} href="/settings/payouts">
            provide a payout method
          </Link>{" "}
          for your invoices.
        </>
      );
    }
  }

  return (
    <MainLayout
      title="Invoices"
      headerActions={
        user.roles.worker ? (
          <Button asChild variant="outline" size="small" disabled={!canSubmitInvoices}>
            <Link href="/invoices/new" inert={!canSubmitInvoices}>
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4">
        {workerNotice ? (
          <Alert>
            <Info className="size-5" />
            <AlertDescription>{workerNotice}</AlertDescription>
          </Alert>
        ) : null}

        <Suspense fallback={<QuickInvoiceSkeleton />}>
          <QuickInvoicesSection />
        </Suspense>
        {data.length > 0 ? (
          <>
            {user.roles.administrator ? (
              <>
                <StripeMicrodepositVerification />
                {!company.completedPaymentMethodSetup && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-5" />
                    <AlertTitle>Bank account setup incomplete.</AlertTitle>
                    <AlertDescription>
                      We're waiting for your bank details to be confirmed. Once done, you'll be able to start approving
                      invoices and paying contractors.
                    </AlertDescription>
                  </Alert>
                )}

                {company.completedPaymentMethodSetup && !company.isTrusted ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-5" />
                    <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
                    <AlertDescription>
                      Email us at <Link href="mailto:support@flexile.com">support@flexile.com</Link> to complete
                      additional verification steps.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {data.some((invoice) => !areTaxRequirementsMet(invoice)) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-5" />
                    <AlertTitle>Missing tax information.</AlertTitle>
                    <AlertDescription>
                      Some invoices are not payable until contractors provide tax information.
                    </AlertDescription>
                  </Alert>
                )}

                {selectedApprovableInvoices.length > 0 && (
                  <Alert className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-between rounded-none border-r-0 border-b-0 border-l-0">
                    <div className="flex items-center gap-2">
                      <Info className="size-4" />
                      <AlertTitle>{selectedRows.length} selected</AlertTitle>
                    </div>
                    <div className="flex flex-row flex-wrap gap-3">
                      <Button variant="outline" onClick={() => setOpenModal("reject")}>
                        Reject selected
                      </Button>
                      <Button disabled={!company.completedPaymentMethodSetup} onClick={() => setOpenModal("approve")}>
                        Approve selected
                      </Button>
                    </div>
                  </Alert>
                )}
              </>
            ) : null}

            <div className="flex justify-between md:hidden">
              <h2 className="text-xl font-bold">
                {data.length} {pluralize("invoice", data.length)}
              </h2>
              <Checkbox
                checked={table.getIsAllRowsSelected()}
                label="Select all"
                onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
              />
            </div>

            <DataTable
              table={table}
              onRowClicked={setDetailInvoice}
              searchColumn={user.roles.administrator ? "billFrom" : undefined}
              actions={
                user.roles.administrator ? (
                  <Button variant="outline" size="small" asChild>
                    <a href={export_company_invoices_path(company.id)}>
                      <Download className="size-4" />
                      Download CSV
                    </a>
                  </Button>
                ) : null
              }
            />
          </>
        ) : (
          <Placeholder icon={CircleCheck}>No invoices to display.</Placeholder>
        )}
      </div>

      <Dialog open={openModal === "approve"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve these invoices?</DialogTitle>
          </DialogHeader>
          {selectedPayableInvoices.length > 0 && (
            <div>
              You are paying{" "}
              {formatMoneyFromCents(
                selectedPayableInvoices.reduce((sum, invoice) => sum + invoice.totalAmountInUsdCents, BigInt(0)),
              )}{" "}
              now.
            </div>
          )}
          <Card>
            <CardContent>
              {selectedInvoices.slice(0, 5).map((invoice, index, array) => (
                <Fragment key={invoice.id}>
                  <div className="flex justify-between gap-2">
                    <b>{invoice.billFrom}</b>
                    <div>{formatMoneyFromCents(invoice.totalAmountInUsdCents)}</div>
                  </div>
                  {index !== array.length - 1 && <Separator />}
                </Fragment>
              ))}
            </CardContent>
          </Card>
          {selectedInvoices.length > 6 && <div>and {data.length - 6} more</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>
              No, cancel
            </Button>
            <MutationButton
              mutation={approveInvoices}
              param={{
                approve_ids: selectedApprovableInvoices.map((invoice) => invoice.id),
                pay_ids: selectedPayableInvoices.map((invoice) => invoice.id),
              }}
            >
              Yes, proceed
            </MutationButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailInvoice && detailInvoice.invoiceType !== "other" ? (
        <TasksModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onReject={() => setOpenModal("reject")}
        />
      ) : null}

      <RejectModal
        open={openModal === "reject"}
        onClose={() => setOpenModal(null)}
        onReject={() => {
          if (detailInvoice) {
            setDetailInvoice(null);
          }
        }}
        ids={detailInvoice ? [detailInvoice.id] : selectedInvoices.map((invoice) => invoice.id)}
      />
    </MainLayout>
  );
}

function InvoicesPageSkeleton() {
  const user = useCurrentUser();

  return (
    <MainLayout
      title="Invoices"
      headerActions={
        user.roles.worker ? (
          <Button asChild variant="outline" size="small">
            <Link href="/invoices/new">
              <Plus className="size-4" />
              New invoice
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4">
        <AlertSkeleton />

        <QuickInvoiceSkeleton />

        {user.roles.administrator ? (
          <>
            <AlertWithTitleSkeleton />
            <AlertWithTitleSkeleton />
            <AlertSkeleton />
          </>
        ) : null}

        <div className="flex justify-between md:hidden">
          <div className="bg-accent h-7 w-32 animate-pulse rounded-md" />
          <div className="bg-accent h-5 w-20 animate-pulse rounded-md" />
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2 md:flex md:justify-between">
            <div className="flex gap-2">
              <div className="bg-accent h-10 w-60 animate-pulse rounded-md" />
              <div className="bg-accent h-10 w-20 animate-pulse rounded-md" />
            </div>
            <div className="bg-accent h-10 w-32 animate-pulse rounded-md" />
          </div>

          <div className="rounded-md border">
            <div className="border-b">
              <div className="flex h-12 items-center gap-4 px-4">
                <div className="bg-accent h-4 w-4 animate-pulse rounded" />
                <div className="bg-accent h-4 w-24 animate-pulse rounded-md" />
                <div className="bg-accent h-4 w-20 animate-pulse rounded-md" />
                <div className="bg-accent h-4 w-16 animate-pulse rounded-md" />
                <div className="bg-accent h-4 w-20 animate-pulse rounded-md" />
                <div className="bg-accent h-4 w-16 animate-pulse rounded-md" />
                <div className="bg-accent h-4 w-16 animate-pulse rounded-md" />
              </div>
            </div>
            <InvoiceTableSkeleton rows={5} isAdministrator={!!user.roles.administrator} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesPageSkeleton />}>
      <InvoicesContent />
    </Suspense>
  );
}

const TasksModal = ({
  invoice,
  onClose,
  onReject,
}: {
  invoice: Invoice;
  onClose: () => void;
  onReject: () => void;
}) => {
  const isActionable = useIsActionable();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-110 p-3">
        <DialogHeader>
          <DialogTitle>{invoice.billFrom}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 grid gap-8">
          {invoice.status === "approved" && invoice.approvals.length > 0 ? (
            <Alert variant="default">
              <Info className="size-5" />
              <AlertDescription>
                Approved by{" "}
                {invoice.approvals
                  .map((approval) => `${approval.approver.name} on ${formatDate(approval.approvedAt, { time: true })}`)
                  .join(", ")}
              </AlertDescription>
            </Alert>
          ) : invoice.status === "rejected" ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-5" />
              <AlertDescription>
                Rejected {invoice.rejector ? `by ${invoice.rejector.name}` : ""}{" "}
                {invoice.rejectedAt ? `on ${formatDate(invoice.rejectedAt)}` : ""} {invoice.rejectionReason}
              </AlertDescription>
            </Alert>
          ) : null}
          <section>
            <header className="flex items-center justify-between gap-4 text-gray-600">
              <h3 className="text-md uppercase">Invoice details</h3>
              <Button variant="link" asChild>
                <Link href={`/invoices/${invoice.id}`}>View invoice</Link>
              </Button>
            </header>
            <Card className="mt-3">
              <CardContent>
                <div className="flex justify-between gap-2">
                  <div>Net amount in cash</div>
                  <div>{formatMoneyFromCents(invoice.cashAmountInCents)}</div>
                </div>
                <Separator />
                {invoice.equityAmountInCents ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <div>Swapped for equity ({invoice.equityPercentage}%)</div>
                      <div>{formatMoneyFromCents(invoice.equityAmountInCents)}</div>
                    </div>
                    <Separator />
                  </>
                ) : null}
                <div className="flex justify-between gap-2 font-bold">
                  <div>Payout total</div>
                  <div>{formatMoneyFromCents(invoice.totalAmountInUsdCents)}</div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
        {isActionable(invoice) ? (
          <DialogFooter>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={onReject}>
                Reject
              </Button>
              <ApproveButton invoice={invoice} onApprove={onClose} />
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const quickInvoiceSchema = z.object({
  amountUsd: z.number().min(0.01),
  duration: z.number().min(0),
  date: z.instanceof(CalendarDate, { message: "This field is required." }),
  invoiceEquityPercent: z.number().min(0).max(100),
});

const QuickInvoicesSection = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  if (!user.roles.worker) return null;
  const isProjectBased = user.roles.worker.payRateType === "project_based";
  const payRateInSubunits = user.roles.worker.payRateInSubunits;

  const { canSubmitInvoices } = useCanSubmitInvoices();
  const form = useForm({
    resolver: zodResolver(quickInvoiceSchema),
    defaultValues: {
      amountUsd: payRateInSubunits ? payRateInSubunits / 100 : 0,
      duration: 0,
      date: today(getLocalTimeZone()),
      invoiceEquityPercent: 0,
    },
    disabled: !canSubmitInvoices,
  });

  const [lockModalOpen, setLockModalOpen] = useState(false);
  const date = form.watch("date");
  const duration = form.watch("duration");
  const amountUsd = form.watch("amountUsd");
  const totalAmountInCents = isProjectBased ? amountUsd * 100 : Math.ceil((duration / 60) * (payRateInSubunits ?? 0));
  const invoiceEquityPercent = form.watch("invoiceEquityPercent");
  const hourlyEquityRateCents =
    totalAmountInCents > 0 ? Math.ceil((payRateInSubunits ?? 0) * (invoiceEquityPercent / 100)) : 0;
  const hourlyRateCashCents =
    totalAmountInCents > 0 ? Math.ceil((payRateInSubunits ?? 0) * (1 - invoiceEquityPercent / 100)) : 0;
  const newCompanyInvoiceRoute = () => {
    const params = new URLSearchParams({ date: date.toString(), split: String(invoiceEquityPercent) });
    if (isProjectBased) params.set("amount", String(amountUsd));
    else params.set("duration", String(duration));
    return `/invoices/new?${params.toString()}` as const;
  };

  const { data: equityAllocation, isLoading: equityAllocationLoading } = trpc.equityAllocations.get.useQuery({
    companyId: company.id,
    year: date.year,
  });

  const { data: equityCalculation } = trpc.equityCalculations.calculate.useQuery({
    companyId: company.id,
    invoiceYear: date.year,
    servicesInCents: totalAmountInCents,
    selectedPercentage: invoiceEquityPercent,
  });

  if (equityAllocationLoading || !equityAllocation) {
    return <QuickInvoiceSkeleton />;
  }
  const equityAmountCents = equityCalculation?.amountInCents ?? 0;
  const cashAmountCents = totalAmountInCents - equityAmountCents;

  const submit = useMutation({
    mutationFn: async () => {
      setLockModalOpen(false);

      await request({
        method: "POST",
        url: company_invoices_path(company.id),
        assertOk: true,
        accept: "json",
        jsonData: {
          invoice: { invoice_date: date.toString() },
          invoice_line_items: [
            isProjectBased
              ? { description: "Project work", total_amount_cents: totalAmountInCents }
              : { description: "Hours worked", minutes: duration },
          ],
        },
      });

      form.reset();
      await trpcUtils.invoices.list.invalidate();
    },
  });

  const handleSubmit = form.handleSubmit(() => {
    if (company.equityCompensationEnabled && !equityAllocation.locked) {
      setLockModalOpen(true);
    } else {
      submit.mutate();
    }
  });

  useEffect(() => {
    if (equityAllocation.equityPercentage) {
      form.setValue("invoiceEquityPercent", equityAllocation.equityPercentage);
    }
  }, [equityAllocation, form]);

  return (
    <Card className={canSubmitInvoices ? "" : "opacity-50"}>
      <CardContent className="p-8">
        <Form {...form}>
          <form
            className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[1fr_auto_1fr]"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <div className="grid gap-6">
              <div className="grid grid-cols-1 gap-6">
                {isProjectBased ? (
                  <div className="grid gap-2">
                    <FormField
                      control={form.control}
                      name="amountUsd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount to bill</FormLabel>
                          <FormControl>
                            <NumberInput {...field} min={0.01} step={0.01} prefix="$" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours worked</FormLabel>
                        <FormControl>
                          <DurationInput {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DatePicker {...field} label="Invoice date" granularity="day" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {company.equityCompensationEnabled ? (
                <FormField
                  control={form.control}
                  name="invoiceEquityPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How much of your rate would you like to swap for equity?</FormLabel>
                      <FormControl>
                        <RangeInput
                          {...field}
                          min={0}
                          max={MAX_EQUITY_PERCENTAGE}
                          unit="%"
                          disabled={!canSubmitInvoices}
                          aria-label="Cash vs equity split"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <Separator orientation="horizontal" className="block w-full lg:hidden" />
            <Separator orientation="vertical" className="hidden lg:block" />

            <div className="grid gap-2">
              {company.equityCompensationEnabled && !isProjectBased ? (
                <>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>Cash amount</span>
                    <span>
                      {formatMoneyFromCents(hourlyRateCashCents)} <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                  <div className="flex justify-between gap-2 text-sm">
                    <span>Equity value</span>
                    <span>
                      {formatMoneyFromCents(hourlyEquityRateCents)} <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                  <div className="flex justify-between gap-2 text-sm">
                    <span>Total rate</span>
                    <span>
                      {formatMoneyFromCents(hourlyRateCashCents + hourlyEquityRateCents)}{" "}
                      <span className="text-gray-500">/ hourly</span>
                    </span>
                  </div>
                  <Separator className="m-0" />
                </>
              ) : null}

              <div className="mt-2 mb-2 pt-2 text-right lg:mt-16 lg:mb-3 lg:pt-0">
                <span className="text-sm text-gray-500">Total amount</span>
                <div className="text-3xl font-bold">{formatMoneyFromCents(totalAmountInCents)}</div>
                {company.equityCompensationEnabled ? (
                  <div className="mt-1 text-sm text-gray-500">
                    ({formatMoneyFromCents(cashAmountCents)} cash + {formatMoneyFromCents(equityAmountCents)} equity)
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" className="grow sm:grow-0" asChild disabled={!canSubmitInvoices}>
                  <Link inert={!canSubmitInvoices} href={newCompanyInvoiceRoute()}>
                    Add more info
                  </Link>
                </Button>
                <MutationStatusButton
                  disabled={!canSubmitInvoices || totalAmountInCents <= 0}
                  className="grow sm:grow-0"
                  mutation={submit}
                  type="submit"
                  loadingText="Sending..."
                >
                  Send for approval
                </MutationStatusButton>
                {company.equityCompensationEnabled && !equityAllocation.locked ? (
                  <EquityPercentageLockModal
                    open={lockModalOpen}
                    onClose={() => setLockModalOpen(false)}
                    percentage={invoiceEquityPercent}
                    year={date.year}
                    onComplete={() => submit.mutate()}
                  />
                ) : null}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
