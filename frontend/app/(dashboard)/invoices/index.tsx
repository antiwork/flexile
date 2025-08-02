import { CurrencyDollarIcon } from "@heroicons/react/20/solid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import MutationButton from "@/components/MutationButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { approve_company_invoices_path, company_invoice_path, reject_company_invoices_path } from "@/utils/routes";

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

  return {
    unsignedContractId: contractSignedElsewhere ? null : unsignedContractId,
    hasLegalDetails,
    canSubmitInvoices: (contractSignedElsewhere || !unsignedContractId) && hasLegalDetails,
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

export const ApproveButton = ({ invoice, onApprove }: { invoice: Invoice; onApprove?: () => void }) => {
  const company = useCurrentCompany();
  const approveInvoices = useApproveInvoices(onApprove);
  const pay = useIsPayable()(invoice);

  return (
    <MutationButton
      mutation={approveInvoices}
      param={{ [pay ? "pay_ids" : "approve_ids"]: [invoice.id] }}
      successText={pay ? "Payment initiated" : "Approved!"}
      loadingText={pay ? "Sending payment..." : "Approving..."}
      disabled={!!pay && (!company.completedPaymentMethodSetup || !taxRequirementsMet(invoice))}
    >
      {pay ? (
        <>
          <CurrencyDollarIcon className="size-4" /> {invoice.status === "failed" ? "Pay again" : "Pay now"}
        </>
      ) : (
        "Approve"
      )}
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
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject {ids.length > 1 ? `${ids.length} invoices` : "invoice"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Explain why the {ids.length > 1 ? "invoices were" : "invoice was"} rejected and how to fix it (optional)
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reject-reason" className="sr-only">
            Rejection reason
          </Label>
          <Textarea
            id="reject-reason"
            placeholder="Enter rejection reason..."
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>No, cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <MutationButton mutation={rejectInvoices} param={{ ids, reason }} loadingText="Rejecting...">
              Yes, reject
            </MutationButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {invoices.length > 1 ? `${invoices.length} invoices` : `invoice "${invoices[0]?.invoiceNumber}"`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {invoices.length > 1
              ? "These invoices will be cancelled and permanently deleted. They won't be payable or recoverable."
              : `This invoice will be cancelled and permanently deleted. It won't be payable or recoverable.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <MutationButton idleVariant="critical" mutation={deleteInvoices} param={{ ids }} loadingText="Deleting...">
              Delete
            </MutationButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
