"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Ban, CircleAlert, MoreHorizontal, Printer, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import AttachmentListCard from "@/components/AttachmentsList";
import { DashboardHeader } from "@/components/DashboardHeader";
import { linkClasses } from "@/components/Link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { linkifyLineItemText } from "@/utils/richText";
import { formatDate, formatDuration } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import {
  Address,
  ApproveButton,
  DeleteModal,
  EDITABLE_INVOICE_STATES,
  LegacyAddress,
  RejectModal,
  StatusDetails,
  taxRequirementsMet,
  useIsActionable,
  useIsDeletable,
} from "..";

const getInvoiceStatusText = (
  invoice: { status: string; approvals: unknown[]; paidAt?: string | Date | null },
  company: { requiredInvoiceApprovals: number },
) => {
  switch (invoice.status) {
    case "received":
    case "approved":
      if (invoice.approvals.length < company.requiredInvoiceApprovals) {
        let label = "Awaiting approval";
        if (company.requiredInvoiceApprovals > 1)
          label += ` (${invoice.approvals.length}/${company.requiredInvoiceApprovals})`;
        return label;
      }
      return "Approved";

    case "processing":
      return "Payment in progress";
    case "payment_pending":
      return "Payment scheduled";
    case "paid":
      return invoice.paidAt ? `Paid on ${formatDate(invoice.paidAt)}` : "Paid";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
  }
};

const PrintHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="print:text-xs print:leading-tight">{children}</div>
);

const PrintTableHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <TableHead
    className={cn(
      "print:border print:border-gray-300 print:bg-gray-100 print:p-1.5 print:text-xs print:font-bold",
      className,
    )}
  >
    {children}
  </TableHead>
);

const PrintTableCell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <TableCell className={cn("print:border print:border-gray-300 print:p-1.5 print:text-xs", className)}>
    {children}
  </TableCell>
);

const PrintTotalRow = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn(
      "flex justify-between gap-2 print:my-1 print:flex print:items-center print:justify-between print:text-xs",
      className,
    )}
  >
    {children}
  </div>
);

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [invoice] = trpc.invoices.get.useSuspenseQuery({ companyId: company.id, id });
  const payRateInSubunits = invoice.contractor.payRateInSubunits;
  const complianceInfo = invoice.contractor.user.complianceInfo;
  const [expenseCategories] = trpc.expenseCategories.list.useSuspenseQuery({ companyId: company.id });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();
  const isActionable = useIsActionable();
  const isDeletable = useIsDeletable();
  const isMobile = useIsMobile();

  const lineItemTotal = (lineItem: (typeof invoice.lineItems)[number]) =>
    Math.ceil((Number(lineItem.quantity) / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits);
  const cashFactor = 1 - invoice.equityPercentage / 100;

  assert(!!invoice.invoiceDate); // must be defined due to model checks in rails

  return (
    <div className="print:bg-white print:font-sans print:text-sm print:leading-tight print:text-black print:*:invisible">
      <DashboardHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        className="pb-4 print:visible print:mb-4 print:px-0 print:pt-0"
        headerActions={
          isMobile ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="p-2">
                <MoreHorizontal className="size-5 text-blue-600" strokeWidth={1.75} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="print:hidden">
                {user.roles.administrator && isActionable(invoice) ? (
                  <>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setRejectModalOpen(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Ban className="size-4" />
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        window.print();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Printer className="size-4" />
                      Print
                    </DropdownMenuItem>
                  </>
                ) : null}

                {user.roles.administrator && !isActionable(invoice) ? (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      window.print();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Printer className="size-4" />
                    Print
                  </DropdownMenuItem>
                ) : null}

                {user.id === invoice.userId && (
                  <>
                    {EDITABLE_INVOICE_STATES.includes(invoice.status) && (
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}/edit`} className="flex items-center gap-2">
                          <SquarePen className="size-4" />
                          Edit invoice
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        window.print();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Printer className="size-4" />
                      Print
                    </DropdownMenuItem>

                    {isDeletable(invoice) && <DropdownMenuSeparator />}

                    {isDeletable(invoice) && (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteModalOpen(true);
                        }}
                        className="focus:text-destructive flex items-center gap-2"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" />
                Print
              </Button>
              {user.roles.administrator && isActionable(invoice) ? (
                <>
                  <Button variant="outline" onClick={() => setRejectModalOpen(true)}>
                    <Ban className="size-4" />
                    Reject
                  </Button>

                  <ApproveButton variant="primary" invoice={invoice} onApprove={() => router.push(`/invoices`)} />
                </>
              ) : null}
              {user.id === invoice.userId ? (
                <>
                  {EDITABLE_INVOICE_STATES.includes(invoice.status) ? (
                    <Button variant="default" asChild>
                      <Link href={`/invoices/${invoice.id}/edit`}>
                        <SquarePen className="size-4" />
                        Edit invoice
                      </Link>
                    </Button>
                  ) : null}

                  {isDeletable(invoice) ? (
                    <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="">
                      <Trash2 className="size-4" />
                      <span>Delete</span>
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          )
        }
      />
      <div className="space-y-4">
        {!taxRequirementsMet(invoice) && (
          <Alert className="mx-4 mb-4 print:hidden" variant="destructive">
            <ExclamationTriangleIcon />
            <AlertTitle>Missing tax information.</AlertTitle>
            <AlertDescription>Invoice is not payable until contractor provides tax information.</AlertDescription>
          </Alert>
        )}
        <StatusDetails invoice={invoice} className="mx-4 mb-4 print:hidden" />

        <div className="mx-4 print:hidden">
          <div className="text-sm text-gray-500">Status</div>
          <div className="font-medium">{getInvoiceStatusText(invoice, company)}</div>
        </div>

        {payRateInSubunits && invoice.lineItems.some((lineItem) => lineItem.payRateInSubunits > payRateInSubunits) ? (
          <Alert className="mx-4 print:hidden" variant="warning">
            <CircleAlert />
            <AlertDescription>
              This invoice includes rates above the default of {formatMoneyFromCents(payRateInSubunits)}/
              {invoice.contractor.payRateType === PayRateType.Custom ? "project" : "hour"}.
            </AlertDescription>
          </Alert>
        ) : null}

        {invoice.equityAmountInCents > 0 ? (
          <Alert className="mx-4 print:hidden">
            <InformationCircleIcon />
            <AlertDescription>
              When this invoice is paid, you'll receive an additional{" "}
              {formatMoneyFromCents(invoice.equityAmountInCents)} in equity. This amount is separate from the total
              shown below.
            </AlertDescription>
          </Alert>
        ) : null}

        <section
          className={cn(
            "invoice-print",
            "print:visible print:m-0 print:max-w-none print:break-before-avoid print:break-inside-avoid print:break-after-avoid print:bg-white print:p-0 print:text-black print:*:visible",
          )}
        >
          <form>
            <div className="grid gap-4 pb-28">
              <div className="grid auto-cols-fr gap-3 p-4 md:grid-flow-col print:mb-4 print:grid-flow-col print:grid-cols-5 print:gap-3 print:border-none print:bg-transparent print:p-0">
                <PrintHeader>
                  From
                  <br />
                  <b className="print:text-sm print:font-bold">{invoice.billFrom}</b>
                  <div>
                    <Address address={invoice} />
                  </div>
                </PrintHeader>
                <PrintHeader>
                  To
                  <br />
                  <b className="print:text-sm print:font-bold">{invoice.billTo}</b>
                  <div>
                    <LegacyAddress address={company.address} />
                  </div>
                </PrintHeader>
                <PrintHeader>
                  Invoice ID
                  <br />
                  {invoice.invoiceNumber}
                </PrintHeader>
                <PrintHeader>
                  Sent on
                  <br />
                  {formatDate(invoice.invoiceDate)}
                </PrintHeader>
                <PrintHeader>
                  Paid on
                  <br />
                  {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
                </PrintHeader>
              </div>

              {invoice.lineItems.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <Table className="w-full min-w-fit print:my-3 print:w-full print:border-collapse print:text-xs">
                    <TableHeader>
                      <TableRow className="print:border-b print:border-gray-300">
                        <PrintTableHeader className="w-[40%] md:w-[50%] print:text-left">
                          {complianceInfo?.businessEntity ? `Services (${complianceInfo.legalName})` : "Services"}
                        </PrintTableHeader>
                        <PrintTableHeader className="w-[20%] text-right md:w-[15%] print:text-right">
                          Qty / Hours
                        </PrintTableHeader>
                        <PrintTableHeader className="w-[20%] text-right md:w-[15%] print:text-right">
                          Cash rate
                        </PrintTableHeader>
                        <PrintTableHeader className="w-[20%] text-right print:text-right">Line total</PrintTableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lineItems.map((lineItem, index) => (
                        <TableRow key={index}>
                          <PrintTableCell className="w-[50%] align-top md:w-[60%] print:align-top">
                            <div className="max-w-full overflow-hidden pr-2 break-words whitespace-normal">
                              {linkifyLineItemText(lineItem.description)}
                            </div>
                          </PrintTableCell>
                          <PrintTableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%] print:text-right print:align-top">
                            {lineItem.hourly ? formatDuration(Number(lineItem.quantity)) : lineItem.quantity}
                          </PrintTableCell>
                          <PrintTableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%] print:text-right print:align-top">
                            {lineItem.payRateInSubunits
                              ? `${formatMoneyFromCents(lineItem.payRateInSubunits * cashFactor)}${lineItem.hourly ? " / hour" : ""}`
                              : ""}
                          </PrintTableCell>
                          <PrintTableCell className="w-[10%] text-right align-top tabular-nums print:text-right print:align-top">
                            {formatMoneyFromCents(lineItemTotal(lineItem) * cashFactor)}
                          </PrintTableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {invoice.expenses.length > 0 && (
                <AttachmentListCard
                  title="Expense"
                  linkClasses={linkClasses}
                  items={invoice.expenses.map((expense) => ({
                    key: expense.attachment?.key || `expense-${expense.id}`,
                    filename: expense.attachment?.filename || "No attachment",
                    label: `${expenseCategories.find((c) => c.id === expense.expenseCategoryId)?.name || "Uncategorized"} – ${expense.description}`,
                    right: <span className="text-sm">{formatMoneyFromCents(expense.totalAmountInCents)}</span>,
                  }))}
                />
              )}

              {invoice.attachment ? (
                <AttachmentListCard
                  title="Documents"
                  linkClasses={linkClasses}
                  items={[
                    {
                      key: invoice.attachment.key,
                      filename: invoice.attachment.filename,
                      label: invoice.attachment.filename,
                    },
                  ]}
                />
              ) : null}

              <footer className="flex flex-col justify-between gap-3 px-4 lg:flex-row print:mt-4 print:flex print:items-start print:justify-between">
                <div className="print:flex-1">
                  {invoice.notes ? (
                    <div>
                      <b className="print:text-sm print:font-bold">Notes</b>
                      <div>
                        <div className="text-xs">
                          <p className="whitespace-pre-wrap print:mt-1 print:text-xs">{invoice.notes}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Card className="self-start print:min-w-36 print:border-none print:bg-transparent print:p-2">
                  <CardContent>
                    {invoice.lineItems.length > 0 && invoice.expenses.length > 0 && (
                      <>
                        <PrintTotalRow>
                          <strong>Total services</strong>
                          <span>
                            {formatMoneyFromCents(
                              invoice.lineItems.reduce(
                                (acc, lineItem) => acc + lineItemTotal(lineItem) * cashFactor,
                                0,
                              ),
                            )}
                          </span>
                        </PrintTotalRow>
                        <Separator className="print:my-1.5 print:border-t print:border-gray-200" />
                        <PrintTotalRow>
                          <strong>Total expenses</strong>
                          <span>
                            {formatMoneyFromCents(
                              invoice.expenses.reduce((acc, expense) => acc + expense.totalAmountInCents, BigInt(0)),
                            )}
                          </span>
                        </PrintTotalRow>
                        <Separator className="print:my-1.5 print:border-t print:border-gray-200" />
                      </>
                    )}
                    <div className="flex justify-between gap-2 print:my-1 print:mt-1.5 print:flex print:items-center print:justify-between print:border-t-2 print:border-gray-300 print:pt-1.5 print:text-sm print:font-bold">
                      <strong>Total</strong>
                      <span>{formatMoneyFromCents(invoice.cashAmountInCents)}</span>
                    </div>
                  </CardContent>
                </Card>
              </footer>
            </div>
          </form>
        </section>
      </div>
      {isMobile && user.roles.administrator && isActionable(invoice) ? (
        <div className="bg-background fixed bottom-15 left-0 z-10 w-full px-4 py-4" style={{ width: "100%" }}>
          <ApproveButton
            className="w-full border-0 bg-blue-500 text-white shadow-lg"
            invoice={invoice}
            onApprove={() => router.push(`/invoices`)}
          />
        </div>
      ) : null}
      <RejectModal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onReject={() => router.push(`/invoices`)}
        ids={[invoice.id]}
      />
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDelete={() => router.push(`/invoices`)}
        invoices={[invoice]}
      />
    </div>
  );
}
