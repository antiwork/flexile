import { ArrowDownTrayIcon, ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { partition } from "lodash-es";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import React, { Fragment, useMemo, useState } from "react";
import StripeMicrodepositVerification from "@/app/administrator/settings/StripeMicrodepositVerification";
import {
  ApproveButton,
  RejectModal,
  useApproveInvoices,
  useAreTaxRequirementsMet,
  useIsActionable,
  useIsPayable,
} from "@/app/invoices/index";
import { StatusWithTooltip } from "@/app/invoices/Status";
import { Task } from "@/app/updates/team/Task";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Tabs from "@/components/Tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { pluralize } from "@/utils/pluralize";
import { export_company_invoices_path } from "@/utils/routes";
import { formatDate, formatDuration } from "@/utils/time";

type Invoice = RouterOutput["invoices"]["list"][number];
export default function AdminList() {
  const company = useCurrentCompany();
  const [invoiceFilter] = useQueryState(
    "tab",
    parseAsStringLiteral(["history", "actionable"]).withDefault("actionable"),
  );
  const [openModal, setOpenModal] = useState<"approve" | "reject" | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const isActionable = useIsActionable();
  const isPayable = useIsPayable();
  const areTaxRequirementsMet = useAreTaxRequirementsMet();
  const [data, { refetch }] = trpc.invoices.list.useSuspenseQuery({
    companyId: company.id,
    invoiceFilter,
  });

  const approveInvoices = useApproveInvoices(() => {
    setOpenModal(null);
    table.resetRowSelection();
    void refetch();
  });

  const columnHelper = createColumnHelper<(typeof data)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("billFrom", {
        header: "Contractor",
        cell: (info) => (
          <>
            <b className="truncate">{info.getValue()}</b>
            <div className="text-xs text-gray-500">{info.row.original.contractor.role.name}</div>
          </>
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
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusWithTooltip invoice={info.row.original} />,
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (isActionable(info.row.original) ? <ApproveButton invoice={info.row.original} /> : null),
      }),
    ],
    [company.requiredInvoiceApprovals],
  );

  const table = useTable({
    columns,
    data,
    getRowId: (invoice) => invoice.id,
    enableRowSelection: invoiceFilter === "actionable",
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedInvoices = selectedRows.map((row) => row.original);
  const [selectedPayableInvoices, selectedApprovableInvoices] = partition(selectedInvoices, isPayable);

  return (
    <MainLayout
      title="Invoicing"
      headerActions={
        invoiceFilter === "history" && (
          <Button variant="outline" asChild>
            <a href={export_company_invoices_path(company.id)}>
              <ArrowDownTrayIcon className="size-4" />
              Download CSV
            </a>
          </Button>
        )
      }
    >
      <Tabs
        links={[
          { label: "Open", route: "?" },
          { label: "History", route: "?tab=history" },
        ]}
      />

      <StripeMicrodepositVerification />

      {data.length > 0 && (
        <div className="grid gap-4">
          {!company.completedPaymentMethodSetup && (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertTitle>Bank account setup incomplete.</AlertTitle>
              <AlertDescription>
                We're waiting for your bank details to be confirmed. Once done, you'll be able to start approving
                invoices and paying contractors.
              </AlertDescription>
            </Alert>
          )}

          {company.completedPaymentMethodSetup && !company.isTrusted ? (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertTitle>Payments to contractors may take up to 10 business days to process.</AlertTitle>
              <AlertDescription>
                Email us at <Link href="mailto:support@flexile.com">support@flexile.com</Link> to complete additional
                verification steps.
              </AlertDescription>
            </Alert>
          ) : null}

          {invoiceFilter === "actionable" && data.some((invoice) => !areTaxRequirementsMet(invoice)) && (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertTitle>Missing tax information.</AlertTitle>
              <AlertDescription>
                Some invoices are not payable until contractors provide tax information.
              </AlertDescription>
            </Alert>
          )}

          {invoiceFilter === "actionable" && selectedRows.length > 0 && (
            <Alert className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-between rounded-none border-r-0 border-b-0 border-l-0">
              <div className="flex items-center gap-2">
                <InformationCircleIcon className="size-4" />
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

          <DataTable table={table} onRowClicked={setDetailInvoice} />
        </div>
      )}

      {data.length === 0 && <Placeholder icon={CheckCircleIcon}>No invoices to display.</Placeholder>}

      <Modal
        open={openModal === "approve"}
        title="Approve these invoices?"
        onClose={() => setOpenModal(null)}
        footer={
          <>
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
          </>
        }
      >
        {selectedPayableInvoices.length > 0 && (
          <div>
            You are paying{" "}
            {formatMoneyFromCents(
              selectedPayableInvoices.reduce((sum, invoice) => sum + invoice.totalAmountInUsdCents, 0n),
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
      </Modal>

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
  const company = useCurrentCompany();
  const isActionable = useIsActionable();
  const { data: tasks } = trpc.teamUpdateTasks.listForInvoice.useQuery({
    companyId: company.id,
    invoiceId: invoice.id,
  });

  return (
    <Modal
      open={!!tasks}
      onClose={onClose}
      sidebar
      className="w-110 p-3"
      title={invoice.billFrom}
      footer={
        isActionable(invoice) ? (
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={onReject}>
              Reject
            </Button>
            <ApproveButton
              invoice={invoice}
              onApprove={() => {
                setTimeout(() => onClose(), 500);
              }}
            />
          </div>
        ) : null
      }
    >
      <div className="mt-4 grid gap-8">
        {invoice.status === "approved" && invoice.approvals.length > 0 ? (
          <Alert variant="default">
            <InformationCircleIcon />
            <AlertDescription>
              Approved by{" "}
              {invoice.approvals
                .map((approval) => `${approval.approver.name} on ${formatDate(approval.approvedAt, { time: true })}`)
                .join(", ")}
            </AlertDescription>
          </Alert>
        ) : invoice.status === "rejected" ? (
          <Alert variant="destructive">
            <ExclamationTriangleIcon />
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
        {company.flags.includes("team_updates") ? (
          <section className="min-w-0">
            <header className="mb-3 flex items-center justify-between gap-4 text-gray-600">
              <h3 className="text-md uppercase">Tasks</h3>
            </header>

            {tasks && tasks.length > 0 ? (
              <Card className="mt-3 max-w-full">
                <CardContent className="overflow-hidden">
                  <ul className="space-y-2">
                    {tasks.map((task) => (
                      <Task key={task.id} task={task} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Placeholder icon={CheckCircleIcon}>No tasks to display yet!</Placeholder>
            )}
          </section>
        ) : null}
      </div>
    </Modal>
  );
};
