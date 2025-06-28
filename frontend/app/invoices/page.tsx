"use client";

import { Download, AlertTriangle, CircleCheck, Info, Pencil, Plus } from "lucide-react";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import Link from "next/link";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import StripeMicrodepositVerification from "@/app/administrator/settings/StripeMicrodepositVerification";
import {
  ApproveButton,
  taxRequirementsMet,
  EDITABLE_INVOICE_STATES,
  RejectModal,
  useApproveInvoices,
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
import { formatDate } from "@/utils/time";
import NumberInput from "@/components/NumberInput";
import QuantityInput from "./QuantityInput";
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
import { invoiceStatuses } from "@/db/enums";

const statusNames = {
  received: "Awaiting approval",
  approved: "Awaiting approval",
  processing: "Processing",
  payment_pending: "Processing",
  paid: "Paid",
  rejected: "Rejected",
  failed: "Failed",
};

const invoiceStatusFilterSchema = z.object({
  status: z.array(z.enum(invoiceStatuses)).optional(),
});

type Invoice = RouterOutput["invoices"]["list"][number];
export default function InvoicesPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [openModal, setOpenModal] = useState<"approve" | "reject" | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const isActionable = useIsActionable();
  const isPayable = useIsPayable();

  const getDefaultStatusFilter = (): (typeof invoiceStatuses)[number][] => [
    "received",
    "approved",
    "payment_pending",
    "rejected",
  ];

  const getStoredStatusFilter = () => {
    try {
      const stored = localStorage.getItem("invoicesStatusFilter");
      if (!stored) return { success: true, data: { status: getDefaultStatusFilter() } };
      return invoiceStatusFilterSchema.safeParse(JSON.parse(stored));
    } catch (_error) {
      return { success: false, data: undefined };
    }
  };

  const storedStatusFilter = getStoredStatusFilter();
  const [statusFilter, setStatusFilter] = useState<(typeof invoiceStatuses)[number][]>(
    storedStatusFilter.success
      ? (storedStatusFilter.data?.status ?? getDefaultStatusFilter())
      : getDefaultStatusFilter(),
  );

  const [data] = trpc.invoices.list.useSuspenseQuery({
    companyId: company.id,
    contractorId: user.roles.administrator ? undefined : user.roles.worker?.id,
    status: statusFilter.length > 0 ? statusFilter : undefined,
  });

  useEffect(() => {
    try {
      localStorage.setItem("invoicesStatusFilter", JSON.stringify({ status: statusFilter }));
    } catch (_error) {
      // localStorage not available (e.g., in test environments) - silently ignore
    }
  }, [statusFilter]);

  const { canSubmitInvoices, hasLegalDetails, unsignedContractId } = useCanSubmitInvoices();

  const approveInvoices = useApproveInvoices(() => {
    setOpenModal(null);
    table.resetRowSelection();
  });

  const toggleFilter = () => {
    if (statusFilter.length === 0) {
      setStatusFilter(["received", "approved", "payment_pending", "rejected"]);
    } else {
      setStatusFilter([]);
    }
  };

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

  const workerNotice = !user.roles.worker ? null : !hasLegalDetails ? (
    <>
      Please{" "}
      <Link className={linkClasses} href="/settings/tax">
        provide your legal details
      </Link>{" "}
      before creating new invoices.
    </>
  ) : unsignedContractId ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>You have an unsigned contract. Please sign it before creating new invoices.</div>
      <Button asChild variant="outline" size="small">
        <Link href={`/documents?${new URLSearchParams({ sign: unsignedContractId.toString(), next: "/invoices" })}`}>
          Review & sign
        </Link>
      </Button>
    </div>
  ) : !user.hasPayoutMethodForInvoices ? (
    <>
      Please{" "}
      <Link className={linkClasses} href="/settings/payouts">
        provide a payout method
      </Link>{" "}
      for your invoices.
    </>
  ) : null;

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

        <QuickInvoicesSection />
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

                {!data.every(taxRequirementsMet) && (
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
                  <>
                    <Button variant="outline" size="small" onClick={toggleFilter} className="mr-2">
                      {statusFilter.length === 0 ? "Show pending invoices only" : "Show all invoices"}
                    </Button>
                    <Button variant="outline" size="small" asChild>
                      <a href={export_company_invoices_path(company.id)}>
                        <Download className="size-4" />
                        Download CSV
                      </a>
                    </Button>
                  </>
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
  rate: z.number().min(0.01),
  quantity: z.object({ quantity: z.number().min(1), hourly: z.boolean() }),
  date: z.instanceof(CalendarDate, { message: "This field is required." }),
  invoiceEquityPercent: z.number().min(0).max(100),
});

const QuickInvoicesSection = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  if (!user.roles.worker) return null;
  const payRateInSubunits = user.roles.worker.payRateInSubunits;
  const isHourly = user.roles.worker.payRateType === "hourly";

  const { canSubmitInvoices } = useCanSubmitInvoices();
  const form = useForm({
    resolver: zodResolver(quickInvoiceSchema),
    defaultValues: {
      rate: payRateInSubunits ? payRateInSubunits / 100 : 0,
      quantity: { quantity: isHourly ? 60 : 1, hourly: isHourly },
      date: today(getLocalTimeZone()),
      invoiceEquityPercent: 0,
    },
    disabled: !canSubmitInvoices,
  });

  const [lockModalOpen, setLockModalOpen] = useState(false);
  const date = form.watch("date");
  const quantity = form.watch("quantity").quantity;
  const hourly = form.watch("quantity").hourly;
  const rate = form.watch("rate") * 100;
  const totalAmountInCents = Math.ceil((quantity / (hourly ? 60 : 1)) * rate);
  const invoiceEquityPercent = form.watch("invoiceEquityPercent");
  const newCompanyInvoiceRoute = () => {
    const params = new URLSearchParams({
      date: date.toString(),
      split: String(invoiceEquityPercent),
      rate: rate.toString(),
      quantity: quantity.toString(),
      hourly: hourly.toString(),
    });
    return `/invoices/new?${params.toString()}` as const;
  };

  const [equityAllocation] = trpc.equityAllocations.get.useSuspenseQuery({
    companyId: company.id,
    year: date.year,
  });

  const { data: equityCalculation } = trpc.equityCalculations.calculate.useQuery({
    companyId: company.id,
    invoiceYear: date.year,
    servicesInCents: totalAmountInCents,
    selectedPercentage: invoiceEquityPercent,
  });
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
          invoice_line_items: [{ description: "-", pay_rate_in_subunits: rate, quantity, hourly }],
        },
      });

      form.reset();
      await trpcUtils.invoices.list.invalidate();
    },
  });

  const handleSubmit = form.handleSubmit(() => {
    if (company.equityCompensationEnabled && !equityAllocation?.locked) {
      setLockModalOpen(true);
    } else {
      submit.mutate();
    }
  });

  useEffect(() => {
    if (equityAllocation?.equityPercentage) {
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
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <NumberInput {...field} min={0.01} step={0.01} prefix="$" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours / Qty</FormLabel>
                    <FormControl>
                      <QuantityInput {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
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
                {company.equityCompensationEnabled && !equityAllocation?.locked ? (
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
