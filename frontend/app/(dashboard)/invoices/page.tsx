"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  CircleAlert,
  CircleCheck,
  Download,
  Eye,
  Info,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import React, { Fragment, useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ApproveButton,
  DeleteModal,
  EDITABLE_INVOICE_STATES,
  RejectModal,
  taxRequirementsMet,
  useApproveInvoices,
  useIsActionable,
  useIsDeletable,
  useIsPayable,
} from "@/app/(dashboard)/invoices/index";
import Status, { StatusDetails } from "@/app/(dashboard)/invoices/Status";
import StripeMicrodepositVerification from "@/app/settings/administrator/StripeMicrodepositVerification";
import { ContextMenuActions } from "@/components/actions/ContextMenuActions";
import { SelectionActions } from "@/components/actions/SelectionActions";
import type { ActionConfig, ActionContext } from "@/components/actions/types";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import DatePicker from "@/components/DatePicker";
import { linkClasses } from "@/components/Link";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { PayRateType, trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";
import { request } from "@/utils/request";
import { company_invoices_path, export_company_invoices_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import QuantityInput from "./QuantityInput";
import { useCanSubmitInvoices } from ".";

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

export default function InvoicesPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [openModal, setOpenModal] = useState<"approve" | "reject" | "delete" | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const isActionable = useIsActionable();
  const isPayable = useIsPayable();
  const isDeletable = useIsDeletable();
  const { data = [], isLoading } = trpc.invoices.list.useQuery({
    companyId: company.id,
    contractorId: user.roles.administrator ? undefined : user.roles.worker?.id,
  });

  const { canSubmitInvoices, hasLegalDetails, unsignedContractId } = useCanSubmitInvoices();

  const isPayNowDisabled = useCallback(
    (invoice: Invoice) => {
      const payable = isPayable(invoice);
      return payable && (!company.completedPaymentMethodSetup || !taxRequirementsMet(invoice));
    },
    [isPayable, company.completedPaymentMethodSetup],
  );
  const actionConfig = useMemo(
    (): ActionConfig<Invoice> => ({
      entityName: "invoices",
      contextMenuGroups: ["navigation", "approval", "destructive", "view"],
      actions: {
        edit: {
          id: "edit",
          label: "Edit",
          icon: SquarePen,
          contexts: ["single"],
          permissions: ["worker"],
          conditions: (invoice: Invoice, _context: ActionContext) => EDITABLE_INVOICE_STATES.includes(invoice.status),
          href: (invoice: Invoice) => `/invoices/${invoice.id}/edit`,
          group: "navigation",
          showIn: ["selection", "contextMenu"],
        },
        reject: {
          id: "reject",
          label: "Reject",
          icon: Ban,
          contexts: ["single", "bulk"],
          permissions: ["administrator"],
          conditions: (invoice: Invoice, _context: ActionContext) => isActionable(invoice),
          action: "reject",
          group: "approval",
          showIn: ["selection", "contextMenu"],
        },
        approve: {
          id: "approve",
          label: "Approve",
          icon: CheckCircle,
          variant: "primary",
          contexts: ["single", "bulk"],
          permissions: ["administrator"],
          conditions: (invoice: Invoice, _context: ActionContext) =>
            isActionable(invoice) && !isPayNowDisabled(invoice),
          action: "approve",
          group: "approval",
          showIn: ["selection", "contextMenu"],
        },
        view: {
          id: "view",
          label: "View invoice",
          icon: Eye,
          contexts: ["single"],
          permissions: ["administrator"],
          conditions: () => true,
          href: (invoice: Invoice) => `/invoices/${invoice.id}`,
          group: "view",
          showIn: ["contextMenu"],
        },
        delete: {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          variant: "destructive",
          contexts: ["single", "bulk"],
          permissions: ["worker"],
          conditions: (invoice: Invoice, _context: ActionContext) => isDeletable(invoice),
          action: "delete",
          group: "destructive",
          showIn: ["selection", "contextMenu"],
          iconOnly: true,
        },
      },
    }),
    [isActionable, isPayNowDisabled, isDeletable],
  );

  const actionContext = useMemo(
    (): ActionContext => ({
      userRole: user.roles.administrator ? "administrator" : "worker",
      permissions: {}, // Using existing hooks directly in conditions instead
    }),
    [user.roles],
  );

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
            <Status invoice={info.row.original} />
          </div>
        ),
        meta: {
          filterOptions: [...new Set(data.map((invoice) => statusNames[invoice.status]))],
        },
      }),
      columnHelper.accessor(isActionable, {
        id: "actions",
        header: () => null,
        cell: (info) => {
          const invoice = info.row.original;

          if (user.roles.administrator && isActionable(invoice)) {
            return <ApproveButton invoice={invoice} />;
          }

          if (invoice.requiresAcceptanceByPayee && user.id === invoice.contractor.user.id) {
            return (
              <Button size="small" asChild>
                <Link href={`/invoices/${invoice.id}?accept=true`}>Accept payment</Link>
              </Button>
            );
          }

          return null;
        },
      }),
    ],
    [],
  );

  const handleInvoiceAction = (actionId: string, invoices: Invoice[]) => {
    const isSingleAction = invoices.length === 1;
    const singleInvoice = invoices[0];

    switch (actionId) {
      case "approve":
        if (isSingleAction && singleInvoice) {
          setDetailInvoice(singleInvoice);
        } else {
          setOpenModal("approve");
        }
        break;
      case "reject":
        setOpenModal("reject");
        break;
      case "delete": {
        const invoiceIds = invoices.map((inv) => inv.id);
        const selection: Record<string, boolean> = {};
        invoiceIds.forEach((id) => {
          selection[id] = true;
        });
        table.setRowSelection(selection);
        setOpenModal("delete");
        break;
      }
    }
  };

  const table = useTable({
    columns,
    data,
    getRowId: (invoice) => invoice.id,
    initialState: {
      sorting: [{ id: user.roles.administrator ? "Status" : "invoiceDate", desc: !user.roles.administrator }],
      columnFilters: user.roles.administrator ? [{ id: "Status", value: ["Awaiting approval", "Failed"] }] : [],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    enableGlobalFilter: !!user.roles.administrator,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedInvoices = selectedRows.map((row) => row.original);

  const selectedApprovableInvoices = useMemo(
    () => selectedInvoices.filter(isActionable),
    [selectedInvoices, isActionable],
  );

  const selectedPayableInvoices = useMemo(
    () => selectedApprovableInvoices.filter(isPayable),
    [selectedApprovableInvoices, isPayable],
  );

  const selectedDeletableInvoices = useMemo(
    () => selectedInvoices.filter(isDeletable),
    [selectedInvoices, isDeletable],
  );

  return (
    <>
      <DashboardHeader
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
      />

      {user.roles.worker ? (
        !hasLegalDetails ? (
          <Alert className="mx-4">
            <Info className="size-4" />
            <AlertDescription>
              Please{" "}
              <Link className={linkClasses} href="/settings/tax">
                provide your legal details
              </Link>{" "}
              before creating new invoices.
            </AlertDescription>
          </Alert>
        ) : unsignedContractId ? (
          <Alert className="mx-4">
            <Info className="size-4" />
            <AlertTitle>You have an unsigned contract.</AlertTitle>
            <AlertDescription>
              Please{" "}
              <Link
                className={linkClasses}
                href={`/documents?${new URLSearchParams({ sign: unsignedContractId.toString(), next: "/invoices" })}`}
              >
                sign it
              </Link>{" "}
              before creating new invoices.
            </AlertDescription>
          </Alert>
        ) : !user.hasPayoutMethodForInvoices ? (
          <Alert className="mx-4">
            <Info className="size-4" />
            <AlertDescription>
              Please{" "}
              <Link className={linkClasses} href="/settings/payouts">
                provide a payout method
              </Link>{" "}
              for your invoices.
            </AlertDescription>
          </Alert>
        ) : null
      ) : null}

      {user.roles.administrator && data.length > 0 && !isLoading ? (
        <>
          <StripeMicrodepositVerification />

          {!company.completedPaymentMethodSetup && (
            <Alert className="mx-4" variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Bank account setup incomplete.</AlertTitle>
              <AlertDescription>
                We're waiting for your bank details to be confirmed. Once done, you'll be able to start approving
                invoices and paying contractors.
              </AlertDescription>
            </Alert>
          )}

          {company.completedPaymentMethodSetup && !company.isTrusted ? (
            <Alert className="mx-4" variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
              <AlertDescription>
                Email us at <Link href="mailto:support@flexile.com">support@flexile.com</Link> to complete additional
                verification steps.
              </AlertDescription>
            </Alert>
          ) : null}

          {!data.every(taxRequirementsMet) && (
            <Alert className="mx-4" variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Missing tax information.</AlertTitle>
              <AlertDescription>
                Some invoices are not payable until contractors provide tax information.
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : null}

      <QuickInvoicesSection />

      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : data.length > 0 ? (
        <>
          <div className="mx-4 flex justify-between md:hidden">
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
            onRowClicked={user.roles.administrator ? setDetailInvoice : undefined}
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
            selectionActions={(selectedRows) => (
              <SelectionActions
                selectedItems={selectedRows}
                config={actionConfig}
                actionContext={actionContext}
                onAction={handleInvoiceAction}
              />
            )}
            contextMenuContent={({ row, selectedRows, onClearSelection }) => (
              <ContextMenuActions
                item={row}
                selectedItems={selectedRows}
                config={actionConfig}
                actionContext={actionContext}
                onAction={handleInvoiceAction}
                onClearSelection={onClearSelection}
              />
            )}
          />
        </>
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>No invoices to display.</Placeholder>
        </div>
      )}

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
              {selectedApprovableInvoices.slice(0, 5).map((invoice, index, array) => (
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
          {selectedApprovableInvoices.length > 5 && <div>and {selectedApprovableInvoices.length - 5} more</div>}
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

      {detailInvoice ? (
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
          table.resetRowSelection();
        }}
        ids={detailInvoice ? [detailInvoice.id] : selectedInvoices.filter(isActionable).map((invoice) => invoice.id)}
      />
      <DeleteModal
        open={openModal === "delete"}
        onClose={() => setOpenModal(null)}
        onDelete={() => {
          setOpenModal(null);
          table.resetRowSelection();
        }}
        invoices={selectedDeletableInvoices}
      />
    </>
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
  const company = useCurrentCompany();
  const [invoiceData] = trpc.invoices.get.useSuspenseQuery({ companyId: company.id, id: invoice.id });
  const payRateInSubunits = invoiceData.contractor.payRateInSubunits;
  const isActionable = useIsActionable();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-110 p-6">
        <DialogHeader>
          <DialogTitle>{invoice.billFrom}</DialogTitle>
        </DialogHeader>
        <section>
          <StatusDetails invoice={invoice} />
          {payRateInSubunits &&
          invoiceData.lineItems.some((lineItem) => lineItem.payRateInSubunits > payRateInSubunits) ? (
            <Alert className="mx-4" variant="warning">
              <CircleAlert />
              <AlertDescription>
                This invoice includes rates above the default of {formatMoneyFromCents(payRateInSubunits)}/
                {invoiceData.contractor.payRateType === PayRateType.Custom ? "project" : "hour"}.
              </AlertDescription>
            </Alert>
          ) : null}
          <header className="flex items-center justify-between gap-4 pt-4">
            <h3>Invoice details</h3>
            <Button variant="outline" size="small" asChild>
              <Link href={`/invoices/${invoice.id}`}>View invoice</Link>
            </Button>
          </header>
          <Separator />
          <Card className="border-none">
            <CardContent className="p-0">
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
              <div className="flex justify-between gap-2 pb-4 font-medium">
                <div>Payout total</div>
                <div>{formatMoneyFromCents(invoice.totalAmountInUsdCents)}</div>
              </div>
            </CardContent>
          </Card>
        </section>
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
  quantity: z.object({ quantity: z.number().min(0.01), hourly: z.boolean() }),
  date: z.instanceof(CalendarDate, { message: "This field is required." }),
});

const QuickInvoicesSection = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const trpcUtils = trpc.useUtils();
  const queryClient = useQueryClient();

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
    },
    disabled: !canSubmitInvoices,
  });

  const date = form.watch("date");
  const quantity = form.watch("quantity").quantity;
  const hourly = form.watch("quantity").hourly;
  const rate = form.watch("rate") * 100;
  const totalAmountInCents = Math.ceil((quantity / (hourly ? 60 : 1)) * rate);
  const newCompanyInvoiceRoute = () => {
    const params = new URLSearchParams({
      date: date.toString(),
      rate: rate.toString(),
      quantity: quantity.toString(),
      hourly: hourly.toString(),
    });
    return `/invoices/new?${params.toString()}` as const;
  };

  const { data: equityCalculation } = trpc.equityCalculations.calculate.useQuery({
    companyId: company.id,
    invoiceYear: date.year,
    servicesInCents: totalAmountInCents,
  });
  const equityAmountCents = equityCalculation?.equityCents ?? 0;
  const cashAmountCents = totalAmountInCents - equityAmountCents;

  const submit = useMutation({
    mutationFn: async () => {
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
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      await trpcUtils.invoices.list.invalidate();
    },
  });

  const handleSubmit = form.handleSubmit(() => submit.mutate());

  return (
    <Card className={canSubmitInvoices ? "" : "opacity-50"}>
      <CardContent>
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
            </div>

            <Separator orientation="horizontal" className="block w-full lg:hidden" />
            <Separator orientation="vertical" className="hidden lg:block" />

            <div className="grid gap-2">
              <div className="mt-2 mb-2 pt-2 text-right lg:mt-16 lg:mb-3 lg:pt-0">
                <span className="text-sm text-gray-500">Total amount</span>
                <div className="text-3xl font-bold">{formatMoneyFromCents(totalAmountInCents)}</div>
                {company.equityEnabled ? (
                  <div className="mt-1 text-sm text-gray-500">
                    ({formatMoneyFromCents(cashAmountCents)} cash +{" "}
                    <Link href="/settings/payouts" className={linkClasses}>
                      {formatMoneyFromCents(equityAmountCents)} equity
                    </Link>
                    )
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
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
