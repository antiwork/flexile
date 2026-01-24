"use client";

import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Ban, CircleAlert, LoaderCircle, MoreHorizontal, Printer, SquarePen, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import AttachmentListCard from "@/components/AttachmentsList";
import { DashboardHeader } from "@/components/DashboardHeader";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import githubMerge from "@/images/github-merge.svg";
import paidDollar from "@/images/paid-dollar.svg";
import unverifiedAuthor from "@/images/unverified-author.svg";
import verifiedAuthor from "@/images/verified-author.svg";
import { FORMATTED_PR_REGEX, GITHUB_PR_REGEX } from "@/lib/regex";
import type { RouterOutput } from "@/trpc";
import { PayRateType, trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { assert } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
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

interface ViewLineItemDescriptionProps {
  description: string;
  contractorGithubUsername: string | null;
  currentInvoiceId: string;
}

const ViewLineItemDescription = ({
  description,
  contractorGithubUsername,
  currentInvoiceId,
}: ViewLineItemDescriptionProps) => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const isAdmin = !!user.roles.administrator;

  const prMatch = description.match(GITHUB_PR_REGEX);
  const formattedMatch = description.match(FORMATTED_PR_REGEX);

  const prUrl = prMatch
    ? prMatch[0]
    : formattedMatch
      ? `https://github.com/${formattedMatch[1]}/pull/${formattedMatch[2]}`
      : null;

  const { data: prResult, isLoading: isFetchingPR } = trpc.github.fetchPullRequest.useQuery(
    { url: prUrl ?? "", companyId: company.id, targetUsername: contractorGithubUsername },
    { enabled: !!prUrl, retry: false },
  );

  if (!prUrl || !prResult) {
    return <div className="max-w-full overflow-hidden pr-2 break-words whitespace-normal">{description}</div>;
  }

  return (
    <ResponsivePRCardView
      prUrl={prUrl}
      prResult={prResult}
      isFetchingPR={isFetchingPR}
      isAdmin={isAdmin}
      currentInvoiceId={currentInvoiceId}
    />
  );
};

interface ResponsivePRCardViewProps {
  prUrl: string | null;
  prResult: RouterOutput["github"]["fetchPullRequest"] | undefined | null;
  isFetchingPR: boolean;
  isAdmin: boolean;
  currentInvoiceId: string;
}

const ResponsivePRCardView = ({
  prUrl,
  prResult,
  isFetchingPR,
  isAdmin,
  currentInvoiceId,
}: ResponsivePRCardViewProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const TriggerContent = (
    <div className="border-input hover:bg-accent focus-within:ring-ring flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-2">
      <Image src={githubMerge} alt="GitHub PR" width={16} height={16} />
      {prResult ? (
        <>
          <span className="bg-secondary truncate rounded-sm px-2 py-0.5 text-xs font-medium">
            {prResult.pr.repository}
          </span>
          <span className="max-w-[200px] truncate font-normal">{prResult.pr.title}</span>
          <span className="text-muted-foreground font-light">#{prResult.pr.number}</span>
          {prResult.pr.bounty_cents ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="border">
                ${prResult.pr.bounty_cents / 100}
              </Badge>
              {prResult.pr.paid_invoice_numbers.filter((i) => i.external_id !== currentInvoiceId).length > 0 ? (
                <div className="size-1.5 rounded-full bg-[#D97706]" title="Paid" />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="text-muted-foreground truncate opacity-70">{prUrl}</span>
        </div>
      )}
      {isFetchingPR ? (
        <div className="ml-auto">
          <LoaderCircle className="text-muted-foreground size-4 animate-spin" />
        </div>
      ) : null}
    </div>
  );

  const DetailsContent = prResult && (
    <div className="flex flex-col">
      <div className="bg-muted/10 flex items-center px-4 py-2">
        <div className="flex items-center gap-1.5 overflow-hidden text-sm font-medium">
          <span className="text-foreground shrink-0">{prResult.pr.repository}</span>
          <span className="text-muted-foreground">⋅</span>
          <span className="text-muted-foreground truncate">{prResult.pr.author}</span>
        </div>
      </div>

      <Separator className="my-0" />

      <div className="px-4 py-4">
        <a
          href={prResult.pr.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-baseline gap-1.5"
        >
          <h4 className="text-[15px] leading-snug font-semibold decoration-blue-500/10 underline-offset-4 group-hover:text-blue-600 group-hover:underline">
            {prResult.pr.title}
          </h4>
          <span className="text-muted-foreground text-xs font-medium">#{prResult.pr.number}</span>
        </a>

        <div className="mt-4 flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white ${
              prResult.pr.merged ? "bg-purple-600" : prResult.pr.state === "open" ? "bg-green-600" : "bg-gray-500"
            }`}
          >
            {prResult.pr.merged ? "Merged" : prResult.pr.state === "open" ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <Separator className="my-0" />

      <div className="bg-muted/50 flex flex-col gap-0">
        {isAdmin && prResult.pr.paid_invoice_numbers.filter((i) => i.external_id !== currentInvoiceId).length > 0 ? (
          <div className="border-border/20 flex items-center gap-3 border-b px-4 py-2">
            <div className="text-muted-foreground flex items-center gap-2.5 text-[12px] font-medium">
              <Image src={paidDollar} alt="" width={16} height={16} className="shrink-0" />
              <span>
                <span className="font-bold text-blue-600">Paid</span> on invoice
                {prResult.pr.paid_invoice_numbers.filter((i) => i.external_id !== currentInvoiceId).length > 1
                  ? "s"
                  : ""}{" "}
                {prResult.pr.paid_invoice_numbers
                  .filter((i) => i.external_id !== currentInvoiceId)
                  .map((invoice, idx, filtered) => (
                    <React.Fragment key={invoice.external_id}>
                      {idx > 0 && (idx === filtered.length - 1 ? " and " : ", ")}
                      <Link
                        href={`/invoices/${invoice.external_id}`}
                        className="text-muted-foreground underline transition-colors hover:text-blue-600"
                      >
                        #{invoice.invoice_number}
                      </Link>
                    </React.Fragment>
                  ))}
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-4 py-2">
          {prResult.pr.verified_author ? (
            <div className="text-muted-foreground flex items-center gap-2.5 text-[12px] font-medium">
              <Image src={verifiedAuthor} alt="" width={16} height={16} className="shrink-0" />
              <span>
                <span className="font-bold text-green-600">Verified author</span> of this pull request.
              </span>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2.5 text-[12px] font-medium">
              <Image src={unverifiedAuthor} alt="" width={16} height={16} className="shrink-0" />
              <span>
                <span className="font-bold">Unverified author</span> of this pull request.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>{TriggerContent}</PopoverTrigger>
        <PopoverContent
          align="start"
          className="border-border/50 w-[calc(100vw-32px)] max-w-[340px] overflow-hidden p-0 shadow-2xl"
        >
          {DetailsContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>{TriggerContent}</HoverCardTrigger>
      {prResult ? (
        <HoverCardContent align="start" className="border-border/50 w-[340px] overflow-hidden p-0 shadow-2xl">
          {DetailsContent}
        </HoverCardContent>
      ) : null}
    </HoverCard>
  );
};
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
                      {invoice.lineItems.map((lineItem, index) => (
                        <TableRow key={index}>
                          <PrintTableCell className="w-[50%] align-top md:w-[60%] print:align-top">
                            <ViewLineItemDescription
                              description={lineItem.description}
                              contractorGithubUsername={invoice.contractor.user.githubUsername}
                              currentInvoiceId={invoice.id}
                            />
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
                                <span className="print:hidden">{formatMoneyFromCents(lineItem.payRateInSubunits)}</span>
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
