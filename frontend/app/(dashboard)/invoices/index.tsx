import { CurrencyDollarIcon } from "@heroicons/react/20/solid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, isWeekend, nextMonday } from "date-fns";
import { Ban, Info } from "lucide-react";
import React, { useEffect, useState } from "react";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { request, ResponseError } from "@/utils/request";
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

type DeferredInvoiceNotice = { invoiceId: string; invoiceNumber: string; message: string };
type ApproveInvoicesResponse = {
  deferred: DeferredInvoiceNotice[];
};

type ApproveInvoicesCallbacks =
  | {
      onSuccess?: (result: ApproveInvoicesResponse) => void;
      onError?: (error: unknown) => void;
    }
  | ((result: ApproveInvoicesResponse) => void)
  | undefined;

const normalizeApproveCallbacks = (callbacks: ApproveInvoicesCallbacks) =>
  typeof callbacks === "function" ? { onSuccess: callbacks } : (callbacks ?? {});

export const useApproveInvoices = (callbacks?: ApproveInvoicesCallbacks) => {
  const utils = trpc.useUtils();
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const { onSuccess, onError } = normalizeApproveCallbacks(callbacks);

  return useMutation<ApproveInvoicesResponse, unknown, { approve_ids?: string[]; pay_ids?: string[] }>({
    mutationFn: async ({ approve_ids, pay_ids }: { approve_ids?: string[]; pay_ids?: string[] }) => {
      const response = await request({
        method: "PATCH",
        url: approve_company_invoices_path(company.id),
        accept: "json",
        jsonData: { approve_ids, pay_ids },
        assertOk: true,
      });

      if (response.status === 204) return { deferred: [] };

      try {
        const data: unknown = await response.json();
        return parseApproveInvoicesResponse(data);
      } catch {
        return { deferred: [] };
      }
    },
    onSuccess: (result) => {
      setTimeout(() => {
        void utils.invoices.list.invalidate({ companyId: company.id });
        void queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        onSuccess?.(result);
      }, 500);
    },
    onError: (error) => {
      onError?.(error);
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
  const pay = useIsPayable()(invoice);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveNotice, setApproveNotice] = useState<string | null>(null);

  const approveInvoicesMutation = useApproveInvoices({
    onSuccess: (result) => {
      setApproveError(null);
      const deferredInvoice = result.deferred.find((item) => item.invoiceId === invoice.id);
      setApproveNotice(deferredInvoice?.message ?? null);
      onApprove?.();
    },
    onError: (error) => {
      const errorMessage = error instanceof ResponseError ? error.message : "Something went wrong. Please try again.";
      setApproveError(errorMessage); // Keep admins informed when the backend blocks payout attempts.
      setApproveNotice(null);
    },
  });

  const { isError, isPending, reset } = approveInvoicesMutation;

  useEffect(() => {
    if (isError && approveError) {
      reset();
    }
  }, [approveError, isError, reset]);

  useEffect(() => {
    if (isPending && approveError) {
      setApproveError(null);
    }
    if (isPending) {
      setApproveNotice(null);
    }
  }, [approveError, isPending]);

  useEffect(() => {
    setApproveNotice(null);
  }, [invoice.id]);

  return (
    <div className="flex flex-col gap-2">
      <MutationButton
        className={className}
        mutation={approveInvoicesMutation}
        idleVariant={variant}
        param={{ [pay ? "pay_ids" : "approve_ids"]: [invoice.id] }}
        successText={pay ? "Payment scheduled" : "Approved!"}
        loadingText={pay ? "Sending payment..." : "Approving..."}
        disabled={!!pay && (!company.completedPaymentMethodSetup || !company.isTrusted)}
      >
        {pay ? (
          <>
            <CurrencyDollarIcon className="size-4" /> {invoice.status === "failed" ? "Pay again" : "Pay now"}
          </>
        ) : (
          "Approve"
        )}
      </MutationButton>
      {approveError ? <p className="text-destructive text-sm">{approveError}</p> : null}
      {!approveError && approveNotice ? <p className="text-muted-foreground text-sm">{approveNotice}</p> : null}
    </div>
  );
};

const parseApproveInvoicesResponse = (value: unknown): ApproveInvoicesResponse => {
  if (!value || typeof value !== "object") return { deferred: [] };
  if (!("deferred" in value)) return { deferred: [] };
  const deferred = readArray(value, "deferred");
  if (!deferred) return { deferred: [] };

  const notices = deferred
    .map(parseDeferredNotice)
    .filter((notice): notice is DeferredInvoiceNotice => notice !== null);

  return { deferred: notices };
};

const readString = (source: object, keys: string[]): string | null => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = readUnknown(source, key);
      if (typeof value === "string") return value;
    }
  }
  return null;
};

const parseDeferredNotice = (item: unknown): DeferredInvoiceNotice | null => {
  if (!item || typeof item !== "object") return null;
  const invoiceId = readString(item, ["invoiceId", "invoice_id"]);
  const invoiceNumber = readString(item, ["invoiceNumber", "invoice_number"]);
  const message = readString(item, ["message"]);
  if (!invoiceId || !invoiceNumber || !message) return null;
  return { invoiceId, invoiceNumber, message };
};

const readArray = (source: unknown, key: string): unknown[] | null => {
  if (!isRecord(source)) return null;
  if (!Object.prototype.hasOwnProperty.call(source, key)) return null;
  const value = readUnknown(source, key);
  return Array.isArray(value) ? value : null;
};

const readUnknown = (source: unknown, key: string): unknown => {
  if (!isRecord(source)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  return source[key];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

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
