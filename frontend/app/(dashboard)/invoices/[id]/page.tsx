"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon, PaperClipIcon, PencilIcon, PrinterIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { Fragment, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate, formatDuration } from "@/utils/time";
import {
  Address,
  ApproveButton,
  DeleteModal,
  EDITABLE_INVOICE_STATES,
  LegacyAddress,
  RejectModal,
  taxRequirementsMet,
  useIsActionable,
  useIsDeletable,
} from "..";
import InvoiceStatus, { StatusDetails } from "../Status";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [invoice, { refetch }] = trpc.invoices.get.useSuspenseQuery({ companyId: company.id, id });
  const payRateInSubunits = invoice.contractor.payRateInSubunits;
  const complianceInfo = invoice.contractor.user.complianceInfo;
  const [expenseCategories] = trpc.expenseCategories.list.useSuspenseQuery({ companyId: company.id });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();
  const isActionable = useIsActionable();
  const isDeletable = useIsDeletable();

  const searchParams = useSearchParams();
  const [acceptPaymentModalOpen, setAcceptPaymentModalOpen] = useState(
    invoice.requiresAcceptanceByPayee && searchParams.get("accept") === "true",
  );
  const acceptPayment = trpc.invoices.acceptPayment.useMutation();
  const defaultEquityPercentage = invoice.minAllowedEquityPercentage ?? invoice.equityPercentage;
  const [equityPercentage, setEquityPercentageElected] = useState(defaultEquityPercentage);

  const equityAmountInCents = useMemo(
    () => (invoice.totalAmountInUsdCents * BigInt(equityPercentage)) / BigInt(100),
    [equityPercentage],
  );

  const cashAmountInCents = useMemo(() => invoice.totalAmountInUsdCents - equityAmountInCents, [equityAmountInCents]);

  const acceptPaymentMutation = useMutation({
    mutationFn: async () => {
      await acceptPayment.mutateAsync({ companyId: company.id, id, equityPercentage });
      await refetch();
      setEquityPercentageElected(defaultEquityPercentage);
      setAcceptPaymentModalOpen(false);
    },
    onSettled: () => {
      acceptPaymentMutation.reset();
    },
  });

  const lineItemTotal = (lineItem: (typeof invoice.lineItems)[number]) =>
    Math.ceil((Number(lineItem.quantity) / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits);
  const cashFactor = 1 - invoice.equityPercentage / 100;

  assert(!!invoice.invoiceDate); // must be defined due to model checks in rails

  return (
    // Added print utilities to the root fragment to apply styles to the body for printing
    <>
      <div className="print:hidden">
        <DashboardHeader
          title={`Invoice ${invoice.invoiceNumber}`}
          headerActions={
            <>
              <InvoiceStatus aria-label="Status" invoice={invoice} />
              <Button onClick={() => window.print()} variant="outline" className="print:hidden">
                <PrinterIcon className="size-4" />
                Print
              </Button>
              {user.roles.administrator && isActionable(invoice) ? (
                <>
                  <Button variant="outline" onClick={() => setRejectModalOpen(true)}>
                    <XMarkIcon className="size-4" />
                    Reject
                  </Button>

                  <RejectModal
                    open={rejectModalOpen}
                    onClose={() => setRejectModalOpen(false)}
                    onReject={() => router.push(`/invoices`)}
                    ids={[invoice.id]}
                  />

                  <ApproveButton invoice={invoice} onApprove={() => router.push(`/invoices`)} />
                </>
              ) : null}
              {user.id === invoice.userId ? (
                <>
                  {invoice.requiresAcceptanceByPayee ? (
                    <Button onClick={() => setAcceptPaymentModalOpen(true)}>Accept payment</Button>
                  ) : EDITABLE_INVOICE_STATES.includes(invoice.status) ? (
                    <Button variant="default" asChild>
                      <Link href={`/invoices/${invoice.id}/edit`}>
                        {invoice.status !== "rejected" && <PencilIcon className="h-4 w-4" />}
                        {invoice.status === "rejected" ? "Submit again" : "Edit invoice"}
                      </Link>
                    </Button>
                  ) : null}

                  {isDeletable(invoice) ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteModalOpen(true)}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span>Delete</span>
                      </Button>
                      <DeleteModal
                        open={deleteModalOpen}
                        onClose={() => setDeleteModalOpen(false)}
                        onDelete={() => router.push(`/invoices`)}
                        invoices={[invoice]}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          }
        />
      </div>

      {invoice.requiresAcceptanceByPayee && user.id === invoice.userId ? (
        <Dialog open={acceptPaymentModalOpen} onOpenChange={setAcceptPaymentModalOpen} className="print:hidden">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept invoice</DialogTitle>
            </DialogHeader>
            <div>
              If everything looks correct, accept the invoice. Then your company administrator can initiate payment.
            </div>
            <Card>
              <CardContent>
                {invoice.minAllowedEquityPercentage !== null && invoice.maxAllowedEquityPercentage !== null ? (
                  <>
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="mb-4 text-gray-600">Cash vs equity split</span>
                        <span className="font-medium">
                          {(equityPercentage / 100).toLocaleString(undefined, { style: "percent" })} equity
                        </span>
                      </div>
                      <Slider
                        className="mb-4"
                        value={[equityPercentage]}
                        onValueChange={([selection]) =>
                          setEquityPercentageElected(selection ?? invoice.minAllowedEquityPercentage ?? 0)
                        }
                        min={invoice.minAllowedEquityPercentage}
                        max={invoice.maxAllowedEquityPercentage}
                      />
                      <div className="flex justify-between text-gray-600">
                        <span>
                          {(invoice.minAllowedEquityPercentage / 100).toLocaleString(undefined, { style: "percent" })}{" "}
                          equity
                        </span>
                        <span>
                          {(invoice.maxAllowedEquityPercentage / 100).toLocaleString(undefined, { style: "percent" })}{" "}
                          equity
                        </span>
                      </div>
                    </div>
                    <Separator />
                  </>
                ) : null}
                <div>
                  <div className="flex items-center justify-between">
                    <span>Cash amount</span>
                    <span className="font-medium">{formatMoneyFromCents(cashAmountInCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Equity value</span>
                    <span className="font-medium">{formatMoneyFromCents(equityAmountInCents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total value</span>
                    <span className="font-medium">{formatMoneyFromCents(invoice.totalAmountInUsdCents)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <div className="flex justify-end">
                <MutationButton mutation={acceptPaymentMutation} successText="Success!" loadingText="Saving...">
                  {invoice.minAllowedEquityPercentage !== null && invoice.maxAllowedEquityPercentage !== null
                    ? `Confirm ${(equityPercentage / 100).toLocaleString(undefined, { style: "percent" })} split`
                    : "Accept payment"}
                </MutationButton>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {!taxRequirementsMet(invoice) && (
        <Alert variant="destructive" className="print:hidden">
          <ExclamationTriangleIcon />
          <AlertTitle>Missing tax information.</AlertTitle>
          <AlertDescription>Invoice is not payable until contractor provides tax information.</AlertDescription>
        </Alert>
      )}

      <StatusDetails invoice={invoice} className="print:hidden" />

      {payRateInSubunits && invoice.lineItems.some((lineItem) => lineItem.payRateInSubunits > payRateInSubunits) ? (
        <Alert variant="warning" className="print:hidden">
          <CircleAlert />
          <AlertDescription>
            This invoice includes rates above the default of {formatMoneyFromCents(payRateInSubunits)}/
            {invoice.contractor.payRateType === PayRateType.Custom ? "project" : "hour"}.
          </AlertDescription>
        </Alert>
      ) : null}

      {invoice.equityAmountInCents > 0 ? (
        <Alert className="print:hidden">
          <InformationCircleIcon />
          <AlertDescription>
            When this invoice is paid, you'll receive an additional {formatMoneyFromCents(invoice.equityAmountInCents)}{" "}
            in equity. This amount is separate from the total shown below.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="invoice-print print:m-0 print:min-h-[85vh] print:w-full print:max-w-full print:border-none print:p-0 print:pt-4 print:pb-8 print:hyphens-none print:*:box-border print:*:max-w-full print:*:rounded-none print:*:bg-transparent print:*:shadow-none print:before:my-2 print:before:mb-6 print:before:block print:before:text-2xl print:before:font-bold print:before:tracking-wide print:before:text-black print:before:content-['INVOICE']">
        <form>
          <div className="grid gap-4">
            <div className="grid auto-cols-fr gap-3 md:grid-flow-col print:mb-6 print:grid-flow-col print:grid-cols-[1fr_1fr_auto_auto_auto] print:items-start print:gap-5 print:leading-[1.4]">
              <div className="print:leading-[1.4] print:font-normal print:[&>*]:m-0 print:[&>*]:text-[10pt] print:[&>*]:leading-[1.4] print:[&>*]:font-normal print:[&>*]:text-black print:[&>*:first-child]:mb-1 print:[&>*:first-child]:text-[9pt] print:[&>*:first-child]:font-medium print:[&>*:first-child]:tracking-wide print:[&>*:first-child]:uppercase print:[&>b]:mb-[0.3em] print:[&>b]:block print:[&>b]:font-semibold">
                From
                <br />
                <b>{invoice.billFrom}</b>
                <div>
                  <Address address={invoice} />
                </div>
              </div>
              <div className="print:leading-[1.4] print:font-normal print:[&>*]:m-0 print:[&>*]:text-[10pt] print:[&>*]:leading-[1.4] print:[&>*]:font-normal print:[&>*]:text-black print:[&>*:first-child]:mb-1 print:[&>*:first-child]:text-[9pt] print:[&>*:first-child]:font-medium print:[&>*:first-child]:tracking-wide print:[&>*:first-child]:uppercase print:[&>b]:mb-[0.3em] print:[&>b]:block print:[&>b]:font-semibold">
                To
                <br />
                <b>{invoice.billTo}</b>
                <div>
                  <LegacyAddress address={company.address} />
                </div>
              </div>
              <div className="print:flex print:flex-col print:items-start print:self-start print:text-left print:text-[10pt] print:leading-[1.2] print:font-normal print:[&>*]:m-0 print:[&>*]:text-[10pt] print:[&>*]:leading-[1.4] print:[&>*]:font-normal print:[&>*]:text-black print:[&>*:first-child]:mb-1 print:[&>*:first-child]:text-[9pt] print:[&>*:first-child]:font-medium print:[&>*:first-child]:tracking-wide print:[&>*:first-child]:uppercase">
                Invoice ID
                <br />
                {invoice.invoiceNumber}
              </div>
              <div className="print:flex print:flex-col print:items-start print:self-start print:text-left print:text-[10pt] print:leading-[1.2] print:font-normal print:[&>*]:m-0 print:[&>*]:text-[10pt] print:[&>*]:leading-[1.4] print:[&>*]:font-normal print:[&>*]:text-black print:[&>*:first-child]:mb-1 print:[&>*:first-child]:text-[9pt] print:[&>*:first-child]:font-medium print:[&>*:first-child]:tracking-wide print:[&>*:first-child]:uppercase">
                Sent on
                <br />
                {formatDate(invoice.invoiceDate)}
              </div>
              <div className="print:flex print:flex-col print:items-start print:self-start print:text-left print:text-[10pt] print:leading-[1.2] print:font-normal print:[&>*]:m-0 print:[&>*]:text-[10pt] print:[&>*]:leading-[1.4] print:[&>*]:font-normal print:[&>*]:text-black print:[&>*:first-child]:mb-1 print:[&>*:first-child]:text-[9pt] print:[&>*:first-child]:font-medium print:[&>*:first-child]:tracking-wide print:[&>*:first-child]:uppercase">
                Paid on
                <br />
                {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
              </div>
            </div>

            {invoice.lineItems.length > 0 ? (
              <Table className="print:m-0 print:mb-6 print:w-full print:border-separate print:border-spacing-x-0 print:border-spacing-y-[0.9em] print:overflow-visible print:border-none">
                <TableHeader className="print:table-header-group">
                  <TableRow>
                    <TableHead className="print:w-[55%] print:border-t-0 print:border-r-0 print:border-b-[1.25px] print:border-l-0 print:border-b-black print:bg-transparent print:px-4 print:py-3 print:pr-6 print:text-left print:text-[7.5pt] print:font-medium print:tracking-wide print:whitespace-nowrap print:text-gray-900 print:uppercase">
                      {complianceInfo?.businessEntity ? `Services (${complianceInfo.legalName})` : "Services"}
                    </TableHead>
                    <TableHead className="print:font-variant-numeric-tabular text-right print:w-24 print:border-t-0 print:border-r-0 print:border-b-[1.25px] print:border-l-0 print:border-b-black print:bg-transparent print:px-4 print:py-3 print:text-right print:text-[7.5pt] print:font-medium print:tracking-wide print:whitespace-nowrap print:text-gray-900 print:uppercase">
                      Qty / Hours
                    </TableHead>
                    <TableHead className="print:font-variant-numeric-tabular text-right print:w-24 print:border-t-0 print:border-r-0 print:border-b-[1.25px] print:border-l-0 print:border-b-black print:bg-transparent print:px-4 print:py-3 print:text-right print:text-[7.5pt] print:font-medium print:tracking-wide print:whitespace-nowrap print:text-gray-900 print:uppercase">
                      Cash rate
                    </TableHead>
                    <TableHead className="print:font-variant-numeric-tabular text-right print:w-28 print:border-t-0 print:border-r-0 print:border-b-[1.25px] print:border-l-0 print:border-b-black print:bg-transparent print:px-4 print:py-3 print:pr-4 print:text-right print:text-[7.5pt] print:font-medium print:tracking-wide print:whitespace-nowrap print:text-gray-900 print:uppercase">
                      Line total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems.map((lineItem, index) => (
                    <TableRow key={index} className="print:page-break-inside-avoid">
                      <TableCell className="print:max-w-[70ch] print:border-t-0 print:border-r-0 print:border-b-[0.5px] print:border-l-0 print:border-b-gray-200 print:bg-white print:px-4 print:py-2 print:align-top print:text-[10pt] print:leading-[1.4] print:break-all print:whitespace-normal print:text-black print:first:pt-2 print:last:border-b-0">
                        {lineItem.description}
                      </TableCell>
                      <TableCell className="print:font-variant-numeric-tabular text-right tabular-nums print:border-t-0 print:border-r-0 print:border-b-[0.5px] print:border-l-0 print:border-b-gray-200 print:bg-white print:px-4 print:py-2 print:align-top print:text-[10pt] print:leading-[1.4] print:font-bold print:text-black print:first:pt-2 print:last:border-b-0">
                        {lineItem.hourly ? formatDuration(Number(lineItem.quantity)) : lineItem.quantity}
                      </TableCell>
                      <TableCell className="print:font-variant-numeric-tabular text-right tabular-nums print:border-t-0 print:border-r-0 print:border-b-[0.5px] print:border-l-0 print:border-b-gray-200 print:bg-white print:px-4 print:py-2 print:align-top print:text-[10pt] print:leading-[1.4] print:font-bold print:text-black print:first:pt-2 print:last:border-b-0">
                        {lineItem.payRateInSubunits
                          ? `${formatMoneyFromCents(lineItem.payRateInSubunits * cashFactor)}${lineItem.hourly ? " / hour" : ""}`
                          : ""}
                      </TableCell>
                      <TableCell className="print:font-variant-numeric-tabular text-right tabular-nums print:border-t-0 print:border-r-0 print:border-b-[0.5px] print:border-l-0 print:border-b-gray-200 print:bg-white print:px-4 print:py-2 print:pr-4 print:align-top print:text-[10pt] print:leading-[1.4] print:font-bold print:text-black print:first:pt-2 print:last:border-b-0">
                        {formatMoneyFromCents(lineItemTotal(lineItem) * cashFactor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {invoice.expenses.length > 0 && (
              <Card className="print:m-0 print:rounded-none print:border-0 print:bg-none print:p-0 print:shadow-none">
                <CardContent className="print:m-0 print:rounded-none print:border-0 print:bg-none print:p-0 print:shadow-none">
                  <div className="flex justify-between gap-2">
                    <div>Expense</div>
                    <div>Amount</div>
                  </div>
                  {invoice.expenses.map((expense, i) => (
                    <Fragment key={i}>
                      <Separator />
                      <div className="flex justify-between gap-2">
                        <Link
                          href={`/download/${expense.attachment?.key}/${expense.attachment?.filename}`}
                          download
                          className={linkClasses}
                        >
                          <PaperClipIcon className="inline size-4" />
                          {expenseCategories.find((category) => category.id === expense.expenseCategoryId)?.name} –{" "}
                          {expense.description}
                        </Link>
                        <span>{formatMoneyFromCents(expense.totalAmountInCents)}</span>
                      </div>
                    </Fragment>
                  ))}
                </CardContent>
              </Card>
            )}

            <footer className="print:page-break-inside-avoid flex justify-between print:mt-4 print:block print:text-right">
              <div>
                {invoice.notes ? (
                  <div>
                    <b>Notes</b>
                    <div>
                      <div className="text-xs">
                        <p>{invoice.notes}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="print:hidden">
                <Card className="print:float-right print:m-0 print:mt-4 print:ml-auto print:w-auto print:rounded-none print:border-0 print:bg-none print:p-0 print:text-right print:shadow-none">
                  <CardContent className="print:m-0 print:rounded-none print:border-0 print:bg-none print:p-0 print:shadow-none">
                    {invoice.lineItems.length > 0 && invoice.expenses.length > 0 && (
                      <>
                        <div className="flex justify-between gap-2">
                          <strong>Total services</strong>
                          <span>
                            {formatMoneyFromCents(
                              invoice.lineItems.reduce(
                                (acc, lineItem) => acc + lineItemTotal(lineItem) * cashFactor,
                                0,
                              ),
                            )}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between gap-2">
                          <strong>Total expenses</strong>
                          <span>
                            {formatMoneyFromCents(
                              invoice.expenses.reduce((acc, expense) => acc + expense.totalAmountInCents, BigInt(0)),
                            )}
                          </span>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="print:[&>span]:font-variant-numeric-tabular flex justify-between gap-2 print:mt-6 print:justify-between print:border-[0.8px] print:border-b print:border-dashed print:border-black print:py-[0.4em] print:text-[11pt] print:[&>span]:font-bold print:[&>strong]:font-bold print:[&>strong]:tracking-wide print:[&>strong]:uppercase">
                      <strong>Total</strong>
                      <span>{formatMoneyFromCents(invoice.cashAmountInCents)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Print-only clean total line */}
              <div className="hidden print:mt-4 print:flex print:justify-end print:gap-2 print:text-[11pt] print:font-bold print:tabular-nums">
                <span className="tracking-wide">Total</span>
                <span>{formatMoneyFromCents(invoice.cashAmountInCents)}</span>
              </div>
            </footer>
          </div>
        </form>
      </section>
    </>
  );
}
