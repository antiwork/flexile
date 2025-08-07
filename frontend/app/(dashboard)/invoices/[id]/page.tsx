"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon, PaperClipIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
    <>
      <DashboardHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        headerActions={
          <>
            <InvoiceStatus aria-label="Status" invoice={invoice} />
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

      {invoice.requiresAcceptanceByPayee && user.id === invoice.userId ? (
        <Dialog open={acceptPaymentModalOpen} onOpenChange={setAcceptPaymentModalOpen}>
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
        <Alert className="mx-4" variant="destructive">
          <ExclamationTriangleIcon />
          <AlertTitle>Missing tax information.</AlertTitle>
          <AlertDescription>Invoice is not payable until contractor provides tax information.</AlertDescription>
        </Alert>
      )}

      <StatusDetails invoice={invoice} />

      {payRateInSubunits && invoice.lineItems.some((lineItem) => lineItem.payRateInSubunits > payRateInSubunits) ? (
        <Alert className="mx-4" variant="warning">
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
            When this invoice is paid, you'll receive an additional {formatMoneyFromCents(invoice.equityAmountInCents)}{" "}
            in equity. This amount is separate from the total shown below.
          </AlertDescription>
        </Alert>
      ) : null}

      <section>
        <form>
          <div className="grid gap-4">
            <div className="mx-4 grid auto-cols-fr gap-3 md:grid-flow-col print:grid-flow-col">
              <div>
                From
                <br />
                <b>{invoice.billFrom}</b>
                <div>
                  <Address address={invoice} />
                </div>
              </div>
              <div>
                To
                <br />
                <b>{invoice.billTo}</b>
                <div>
                  <LegacyAddress address={company.address} />
                </div>
              </div>
              <div>
                Invoice ID
                <br />
                {invoice.invoiceNumber}
              </div>
              <div>
                Sent on
                <br />
                {formatDate(invoice.invoiceDate)}
              </div>
              <div>
                Paid on
                <br />
                {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
              </div>
            </div>

            {invoice.lineItems.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <Table className="w-full min-w-[600px] table-fixed md:max-w-full md:min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%] md:w-[60%]">
                        {complianceInfo?.businessEntity ? `Services (${complianceInfo.legalName})` : "Services"}
                      </TableHead>
                      <TableHead className="w-[20%] text-right md:w-[15%]">Qty / Hours</TableHead>
                      <TableHead className="w-[20%] text-right md:w-[15%]">Cash rate</TableHead>
                      <TableHead className="w-[10%] text-right">Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map((lineItem, index) => (
                      <TableRow key={index}>
                        <TableCell className="w-[50%] align-top md:w-[60%]">
                          <div
                            className="overflow-hidden pr-2 whitespace-normal md:max-w-full"
                            style={{
                              wordBreak: "break-word",
                            }}
                          >
                            {lineItem.description}
                          </div>
                        </TableCell>
                        <TableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%]">
                          {lineItem.hourly ? formatDuration(Number(lineItem.quantity)) : lineItem.quantity}
                        </TableCell>
                        <TableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%]">
                          {lineItem.payRateInSubunits
                            ? `${formatMoneyFromCents(lineItem.payRateInSubunits * cashFactor)}${lineItem.hourly ? " / hour" : ""}`
                            : ""}
                        </TableCell>
                        <TableCell className="w-[10%] text-right align-top tabular-nums">
                          {formatMoneyFromCents(lineItemTotal(lineItem) * cashFactor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {invoice.expenses.length > 0 && (
              <Card>
                <CardContent>
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

            <footer className="flex justify-between">
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
              <Card>
                <CardContent>
                  {invoice.lineItems.length > 0 && invoice.expenses.length > 0 && (
                    <>
                      <div className="flex justify-between gap-2">
                        <strong>Total services</strong>
                        <span>
                          {formatMoneyFromCents(
                            invoice.lineItems.reduce((acc, lineItem) => acc + lineItemTotal(lineItem) * cashFactor, 0),
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
                  <div className="flex justify-between gap-2">
                    <strong>Total</strong>
                    <span>{formatMoneyFromCents(invoice.cashAmountInCents)}</span>
                  </div>
                </CardContent>
              </Card>
            </footer>
          </div>
        </form>
      </section>
    </>
  );
}
