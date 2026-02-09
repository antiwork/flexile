import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, isWeekend, nextMonday } from "date-fns";
import { Ban, Info } from "lucide-react";
import React, { useState } from "react";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { approve_company_invoices_path, company_invoice_path, reject_company_invoices_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

type Invoice = RouterOutput["invoices"]["list"][number] | RouterOutput["invoices"]["get"];
export const EDITABLE_INVOICE_STATES: Invoice["status"][] = ["received", "rejected"];
export const DELETABLE_INVOICE_STATES: Invoice["status"][] = ["received", "approved"];

export const taxRequirementsMet = (invoice: Invoice) =>
  !!invoice.contractor.user.complianceInfo?.taxInformationConfirmedAt;

export const useCanSubmitInvoices = () => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const { data: documents } = trpc.documents.list.useQuery(
    { companyId: company.id, userId: user.id, signable: true },
    { enabled: !!user.roles.worker },
  );
  const { data: contractorInfo } = trpc.users.getContractorInfo.useQuery(
    { companyId: company.id },
    { enabled: !!user.roles.worker },
  );
  const unsignedContractId = documents?.[0]?.id;
  const hasLegalDetails = user.address.street_address && !!user.taxInformationConfirmedAt;
  const contractSignedElsewhere = contractorInfo?.contractSignedElsewhere ?? false;
  const hasPayoutInfo = user.hasPayoutMethodForInvoices;

  return {
    unsignedContractId: contractSignedElsewhere ? null : unsignedContractId,
    hasLegalDetails,
    canSubmitInvoices: (contractSignedElsewhere || !unsignedContractId) && hasLegalDetails && hasPayoutInfo,
  };
};

export const Address = ({
  address,
}: {
  address: Pick<RouterOutput["invoices"]["get"], "streetAddress" | "city" | "zipCode" | "state" | "countryCode">;
}) => (
  <>
    {address.streetAddress}
    <br />
    {address.city}
    <br />
    {address.zipCode}
    {address.state ? `, ${address.state}` : null}
    <br />
    {address.countryCode ? new Intl.DisplayNames(["en"], { type: "region" }).of(address.countryCode) : null}
  </>
);

export const LegacyAddress = ({
  address,
}: {
  address: {
    street_address: string | null;
    city: string | null;
    zip_code: string | null;
    state: string | null;
    country: string | null;
    country_code: string | null;
  };
}) => (
  <>
    {address.street_address}
    <br />
    {address.city}
    <br />
    {address.zip_code}
    {address.state ? `, ${address.state}` : null}
    <br />
    {address.country}
  </>
);

const useIsApprovedByCurrentUser = () => {
  const user = useCurrentUser();
  return (invoice: Invoice) => invoice.approvals.some((approval) => approval.approver.id === user.id);
};

export function useIsActionable() {
  const isPayable = useIsPayable();
  const isApprovedByCurrentUser = useIsApprovedByCurrentUser();

  return (invoice: Invoice) =>
    isPayable(invoice) || (!isApprovedByCurrentUser(invoice) && ["received", "approved"].includes(invoice.status));
}

export function useIsPayable() {
  const company = useCurrentCompany();
  const isApprovedByCurrentUser = useIsApprovedByCurrentUser();

  return (invoice: Invoice) =>
    invoice.status === "failed" ||
    (["received", "approved"].includes(invoice.status) &&
      !invoice.requiresAcceptanceByPayee &&
      company.requiredInvoiceApprovals - invoice.approvals.length <= (isApprovedByCurrentUser(invoice) ? 0 : 1));
}

export function useIsDeletable() {
  const user = useCurrentUser();

  return (invoice: Invoice) =>
    DELETABLE_INVOICE_STATES.includes(invoice.status) &&
    !invoice.requiresAcceptanceByPayee &&
    user.id === invoice.contractor.user.id;
}

export const useApproveInvoices = (onSuccess?: () => void) => {
  const utils = trpc.useUtils();
  const company = useCurrentCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ approve_ids, pay_ids }: { approve_ids?: string[]; pay_ids?: string[] }) => {
      await request({
        method: "PATCH",
        url: approve_company_invoices_path(company.id),
        accept: "json",
        jsonData: { approve_ids, pay_ids },
        assertOk: true,
      });
    },
    onSuccess: () => {
      setTimeout(() => {
        void utils.invoices.list.invalidate({ companyId: company.id });
        void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        onSuccess?.();
      }, 500);
    },
  });
};

export const ApproveButton = ({
  variant,
  invoice,
  onApprove,
  className,
}: {
  invoice: Invoice;
  variant?: React.ComponentProps<typeof Button>["variant"];
  onApprove?: () => void;
  className?: string;
}) => {
  const company = useCurrentCompany();
  const approveInvoices = useApproveInvoices(onApprove);
  const pay = useIsPayable()(invoice);

  return (
    <MutationButton
      className={className}
      mutation={approveInvoices}
      idleVariant={variant}
      param={{ [pay ? "pay_ids" : "approve_ids"]: [invoice.id] }}
      successText={pay ? "Payment initiated" : "Approved!"}
      loadingText={pay ? "Sending payment..." : "Approving..."}
      disabled={!!pay && (!company.completedPaymentMethodSetup || !company.isTrusted || !company.taxId)}
    >
      Approve
    </MutationButton>
  );
};

export const useRejectInvoices = (onSuccess?: () => void) => {
  const utils = trpc.useUtils();
  const company = useCurrentCompany();

  return useMutation({
    mutationFn: async (params: { ids: string[]; reason: string }) => {
      await request({
        method: "PATCH",
        url: reject_company_invoices_path(company.id),
        accept: "json",
        jsonData: params,
      });
      await utils.invoices.list.invalidate({ companyId: company.id });
    },
    onSuccess: () => onSuccess?.(),
  });
};

export const RejectModal = ({
  open,
  ids,
  onClose,
  onReject,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
  onReject?: () => void;
}) => {
  const rejectInvoices = useRejectInvoices(() => {
    onReject?.();
    onClose();
  });
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {ids.length > 1 ? `${ids.length} invoices` : "invoice"}?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reject-reason">
            Optionally, explain why the {ids.length > 1 ? "invoices were" : "invoice was"} rejected and how to fix it.
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            className="min-h-32"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            No, cancel
          </Button>
          <MutationButton
            idleVariant="primary"
            mutation={rejectInvoices}
            param={{ ids, reason }}
            loadingText="Rejecting..."
          >
            Yes, reject
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteModal = ({
  open,
  invoices,
  onClose,
  onDelete,
}: {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
  onDelete?: () => void;
}) => {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const ids = invoices.map((invoice) => invoice.id);

  const deleteInvoices = useMutation({
    mutationFn: async (params: { ids: string[] }) => {
      await Promise.all(
        params.ids.map(async (invoiceId) => {
          await request({
            method: "DELETE",
            url: company_invoice_path(company.id, invoiceId),
            accept: "json",
            assertOk: true,
          });
        }),
      );
    },
    onSuccess: () => {
      void utils.invoices.list.invalidate({ companyId: company.id });
      onDelete?.();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {invoices.length > 1 ? `${invoices.length} invoices` : `invoice "${invoices[0]?.invoiceNumber}"`}?
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <p className="text-sm">
            {invoices.length > 1
              ? "These invoices will be cancelled and permanently deleted. They won't be payable or recoverable."
              : `This invoice will be cancelled and permanently deleted. It won't be payable or recoverable.`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <MutationButton idleVariant="critical" mutation={deleteInvoices} param={{ ids }} loadingText="Deleting...">
            Delete
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function StatusDetails({ invoice, className }: { invoice: Invoice; className?: string }) {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [{ invoice: consolidatedInvoice }] = trpc.consolidatedInvoices.last.useSuspenseQuery({ companyId: company.id });

  const getDetails = () => {
    let details = null;
    switch (invoice.status) {
      case "approved":
        if (invoice.approvals.length > 0) {
          details = (
            <ul className="list-disc pl-5">
              {invoice.approvals.map((approval, index) => (
                <li key={index}>
                  Approved by {approval.approver.id === user.id ? "you" : approval.approver.name} on{" "}
                  {formatDate(approval.approvedAt, { time: true })}
                </li>
              ))}
            </ul>
          );
        }
        break;
      case "rejected":
        details = "Rejected";
        if (invoice.rejector) details += ` by ${invoice.rejector.name}`;
        if (invoice.rejectedAt) details += ` on ${formatDate(invoice.rejectedAt)}`;
        if (invoice.rejectionReason) details += `: "${invoice.rejectionReason}"`;
        break;
      case "payment_pending":
      case "processing":
        if (consolidatedInvoice) {
          let paymentExpectedBy = addDays(consolidatedInvoice.createdAt, company.paymentProcessingDays);
          if (isWeekend(paymentExpectedBy)) paymentExpectedBy = nextMonday(paymentExpectedBy);
          details = `Your payment should arrive by ${formatDate(paymentExpectedBy)}`;
        }
        break;
      default:
        break;
    }
    return details;
  };

  const statusDetails = getDetails();

  return statusDetails ? (
    <Alert className={cn(className)} {...(invoice.status === "rejected" && { variant: "destructive" })}>
      {invoice.status === "rejected" ? <Ban /> : <Info />}
      <AlertDescription>{statusDetails}</AlertDescription>
    </Alert>
  ) : null;
}

export function Totals({
  servicesTotal,
  expensesTotal,
  equityAmountInCents,
  equityPercentage,
  isOwnUser,
  className,
}: {
  servicesTotal: number | bigint;
  expensesTotal: number | bigint;
  equityAmountInCents: number | bigint;
  equityPercentage: number;
  isOwnUser: boolean;
  className?: string;
}) {
  const company = useCurrentCompany();
  return (
    <Card className={cn("w-full self-start lg:w-auto lg:min-w-90", className)}>
      {servicesTotal > 0 && expensesTotal > 0 && (
        <CardContent className="border-border grid gap-4 border-b">
          <div className="flex justify-between gap-2">
            <span>Total services</span>
            {formatMoneyFromCents(servicesTotal)}
          </div>
          <div className="flex justify-between gap-2">
            <span>Total expenses</span>
            <span>{formatMoneyFromCents(expensesTotal)}</span>
          </div>
        </CardContent>
      )}
      {company.equityEnabled || equityPercentage > 0 ? (
        <CardContent className="border-border grid gap-4 border-b">
          <h4 className="font-medium">Payment split</h4>
          <div className="flex justify-between gap-2">
            <span>Cash</span>
            <span>{formatMoneyFromCents(BigInt(servicesTotal) - BigInt(equityAmountInCents))}</span>
          </div>
          <div>
            <div className="flex justify-between gap-2">
              <span>Equity</span>
              <span>{formatMoneyFromCents(equityAmountInCents)}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              Swapping {(equityPercentage / 100).toLocaleString([], { style: "percent" })} for company equity.
            </div>
          </div>
        </CardContent>
      ) : null}
      <CardContent className="bg-muted/20 rounded-b-md py-3 font-medium first:rounded-t-md">
        <div className="flex justify-between gap-2">
          <span>{isOwnUser ? "You'll" : "They'll"} receive in cash</span>
          <span>
            {formatMoneyFromCents(BigInt(servicesTotal) - BigInt(equityAmountInCents) + BigInt(expensesTotal))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
