"use client";

import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Ban, CircleAlert, MoreHorizontal, Printer, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import AttachmentListCard from "@/components/AttachmentsList";
import { DashboardHeader } from "@/components/DashboardHeader";
import { GitHubPRHoverCard } from "@/components/GitHubPRHoverCard";
import { GitHubPRIcon } from "@/components/GitHubPRIcon";
import { linkClasses } from "@/components/Link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { parsePRState, type PRDetails, truncatePRTitle } from "@/utils/github";
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
  Totals,
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

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [invoice] = trpc.invoices.get.useSuspenseQuery({ companyId: company.id, id });
  const payRateInSubunits = invoice.contractor.payRateInSubunits;
  const complianceInfo = invoice.contractor.user.complianceInfo;
  const [expenseCategories] = trpc.expenseCategories.list.useSuspenseQuery({ companyId: company.id });
  const [{ invoice: consolidatedInvoice }] = trpc.consolidatedInvoices.last.useSuspenseQuery({ companyId: company.id });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();
  const isActionable = useIsActionable();
  const isDeletable = useIsDeletable();
  const isMobile = useIsMobile();

  const lineItemTotal = (lineItem: (typeof invoice.lineItems)[number]) =>
    Math.ceil((Number(lineItem.quantity) / (lineItem.hourly ? 60 : 1)) * lineItem.payRateInSubunits);
  const servicesTotal = invoice.lineItems.reduce((acc, lineItem) => acc + lineItemTotal(lineItem), 0);
  const cashFactor = 1 - invoice.equityPercentage / 100;

  assert(!!invoice.invoiceDate); // must be defined due to model checks in rails

  return (
    <div className="print:bg-white print:font-sans print:text-sm print:leading-tight print:text-black print:*:invisible">
      <DashboardHeader
        title={
          <div className="flex items-center gap-2">
            <Link href="/invoices" aria-label="Back to invoices">
              <ArrowLeftIcon className="size-6" />
            </Link>{" "}
            <span>Invoice {invoice.invoiceNumber}</span>
          </div>
        }
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
        <StatusDetails invoice={invoice} consolidatedInvoice={consolidatedInvoice} className="mx-4 mb-4 print:hidden" />

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
                          <div className="hidden print:inline">Cash rate</div>
                          <div className="print:hidden">Rate</div>
                        </PrintTableHeader>
                        <PrintTableHeader className="w-[20%] text-right print:text-right">Line total</PrintTableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lineItems.map((lineItem, index) => {
                        const hasPR = !!lineItem.githubPrUrl;

                        const prDetails: PRDetails | null = hasPR
                          ? {
                              url: lineItem.githubPrUrl ?? "",
                              number: lineItem.githubPrNumber ?? 0,
                              title: lineItem.githubPrTitle ?? "",
                              state: parsePRState(lineItem.githubPrState),
                              author: lineItem.githubPrAuthor ?? "",
                              repo: lineItem.githubPrRepo ?? "",
                              bounty_cents: lineItem.githubPrBountyCents ?? null,
                            }
                          : null;

                        const contractorGithubUsername = invoice.contractor.user.githubUsername;
                        const isVerified =
                          hasPR && contractorGithubUsername
                            ? prDetails?.author.toLowerCase() === contractorGithubUsername.toLowerCase()
                            : null;

                        const paidInvoices = lineItem.paidInvoices.map((inv) => ({
                          invoiceId: inv.invoiceId,
                          invoiceNumber: inv.invoiceNumber,
                        }));

                        const total = lineItemTotal(lineItem);
                        const hasBountyMismatch = prDetails?.bounty_cents != null && prDetails.bounty_cents !== total;

                        const showStatusDot =
                          user.roles.administrator &&
                          hasPR &&
                          (isVerified === false || paidInvoices.length > 0 || hasBountyMismatch) &&
                          invoice.status !== "paid";

                        return (
                          <TableRow key={index}>
                            <PrintTableCell className="w-[50%] align-top md:w-[60%] print:align-top">
                              {hasPR && prDetails ? (
                                <GitHubPRHoverCard
                                  pr={prDetails}
                                  currentUserGitHubUsername={contractorGithubUsername}
                                  paidInvoices={paidInvoices}
                                  lineItemTotal={total}
                                >
                                  <a
                                    href={prDetails.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 hover:underline"
                                  >
                                    <GitHubPRIcon state={prDetails.state} />
                                    <Badge
                                      variant="secondary"
                                      className="text-foreground shrink-0 bg-black/[0.03] dark:bg-white/[0.08]"
                                    >
                                      {prDetails.repo}
                                    </Badge>
                                    <span className="truncate">
                                      {truncatePRTitle(prDetails.title, 40)} #{prDetails.number}
                                    </span>
                                    {prDetails.bounty_cents ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-foreground shrink-0 bg-black/[0.03] dark:bg-white/[0.08]"
                                      >
                                        {formatMoneyFromCents(prDetails.bounty_cents, { compact: true })}
                                      </Badge>
                                    ) : null}
                                    {showStatusDot ? (
                                      <span
                                        className="size-2 shrink-0 rounded-full bg-amber-500"
                                        aria-label="Needs attention"
                                      />
                                    ) : null}
                                  </a>
                                </GitHubPRHoverCard>
                              ) : (
                                <div className="max-w-full overflow-hidden pr-2 break-words whitespace-normal">
                                  {lineItem.description}
                                </div>
                              )}
                            </PrintTableCell>
                            <PrintTableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%] print:text-right print:align-top">
                              {lineItem.hourly ? formatDuration(Number(lineItem.quantity)) : lineItem.quantity}
                            </PrintTableCell>
                            <PrintTableCell className="w-[20%] text-right align-top tabular-nums md:w-[15%] print:text-right print:align-top">
                              {lineItem.payRateInSubunits ? (
                                <>
                                  <div className="hidden print:inline">
                                    {formatMoneyFromCents(lineItem.payRateInSubunits * cashFactor)}
                                  </div>
                                  <span className="print:hidden">
                                    {formatMoneyFromCents(lineItem.payRateInSubunits)}
                                  </span>
                                  <span>{lineItem.hourly ? " / hour" : ""}</span>
                                </>
                              ) : null}
                            </PrintTableCell>
                            <PrintTableCell className="w-[10%] text-right align-top tabular-nums print:text-right print:align-top">
                              <span className="hidden print:inline">
                                {formatMoneyFromCents(lineItemTotal(lineItem) * cashFactor)}
                              </span>
                              <span className="print:hidden">{formatMoneyFromCents(lineItemTotal(lineItem))}</span>
                            </PrintTableCell>
                          </TableRow>
                        );
                      })}
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
                <Totals
                  servicesTotal={servicesTotal}
                  expensesTotal={invoice.expenses.reduce((acc, expense) => acc + expense.totalAmountInCents, BigInt(0))}
                  equityAmountInCents={invoice.equityAmountInCents}
                  equityPercentage={invoice.equityPercentage}
                  isOwnUser={user.id === invoice.userId}
                  className="print:hidden"
                />
                <div className="ml-auto hidden bg-gray-50 p-2 print:block">
                  <strong>Total {formatMoneyFromCents(invoice.cashAmountInCents)}</strong>
                </div>
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
