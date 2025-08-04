"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import {
  ArrowUpRightFromSquare,
  BriefcaseBusiness,
  CircleCheck,
  Download,
  EllipsisVertical,
  Info,
  SendHorizontal,
  Trash2Icon,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import React, { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FinishOnboarding } from "@/app/(dashboard)/documents/FinishOnboarding";
import ComboBox from "@/components/ComboBox";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, filterValueSchema, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import { NewDocument } from "@/components/NewDocument";
import Placeholder from "@/components/Placeholder";
import Status, { type Variant as StatusVariant } from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { storageKeys } from "@/models/constants";
import { type Document, documentSchema } from "@/models/document";
import { DocumentType, trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import {
  company_document_path,
  company_documents_path,
  share_company_document_path,
  sign_company_document_path,
} from "@/utils/routes";
import { formatDate } from "@/utils/time";

type SignableDocument = Document;

const typeLabels = {
  [DocumentType.ConsultingContract]: "Agreement",
  [DocumentType.ShareCertificate]: "Certificate",
  [DocumentType.TaxDocument]: "Tax form",
  [DocumentType.ExerciseNotice]: "Exercise notice",
  [DocumentType.EquityPlanContract]: "Equity plan",
};

const columnFiltersSchema = z.array(z.object({ id: z.string(), value: filterValueSchema }));

const getCompletedAt = (document: Document) =>
  document.signatories.every((signatory) => signatory.signedAt)
    ? document.signatories.reduce<Date | null>(
        (acc, signatory) =>
          acc ? (signatory.signedAt && signatory.signedAt > acc ? signatory.signedAt : acc) : signatory.signedAt,
        null,
      )
    : undefined;

function getStatus(document: Document): { variant: StatusVariant | undefined; name: string; text: string } {
  const completedAt = getCompletedAt(document);

  switch (document.type) {
    case DocumentType.TaxDocument:
      if (document.name.startsWith("W-") || completedAt) {
        return {
          variant: "success",
          name: "Signed",
          text: completedAt ? `Filed on ${formatDate(completedAt)}` : "Signed",
        };
      }
      return { variant: undefined, name: "Ready for filing", text: "Ready for filing" };
    case DocumentType.ShareCertificate:
    case DocumentType.ExerciseNotice:
      return { variant: "success", name: "Issued", text: "Issued" };
    case DocumentType.ConsultingContract:
    case DocumentType.EquityPlanContract:
      return completedAt
        ? { variant: "success", name: "Signed", text: "Signed" }
        : { variant: "critical", name: "Signature required", text: "Signature required" };
  }
}

const getDownloadUrl = (document: Document) => {
  if (document.attachment) {
    return `/download/${document.attachment.key}/${document.attachment.filename}`;
  }
  return null;
};

const inviteLawyerSchema = z.object({
  email: z.string().email(),
});

export default function DocumentsPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const isCompanyRepresentative = !!user.roles.administrator || !!user.roles.lawyer;
  const userId = isCompanyRepresentative ? null : user.id;
  const canSign = user.address.street_address || isCompanyRepresentative;

  const [forceWorkerOnboarding, setForceWorkerOnboarding] = useState<boolean>(
    user.roles.worker ? !user.roles.worker.role : false,
  );

  const currentYear = new Date().getFullYear();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        accept: "json",
        url: company_documents_path(company.id),
        assertOk: true,
      });
      return z.array(documentSchema).parse(await response.json());
    },
  });

  const inviteLawyerForm = useForm({ resolver: zodResolver(inviteLawyerSchema) });
  const inviteLawyer = trpc.lawyers.invite.useMutation({
    onSuccess: () => {
      setShowInviteModal(false);
      inviteLawyerForm.reset();
    },
  });
  const submitInviteLawyer = inviteLawyerForm.handleSubmit(async ({ email }) =>
    inviteLawyer.mutateAsync({ companyId: company.id, email }),
  );

  const columnHelper = createColumnHelper<Document>();
  const [documentAction, setDocumentAction] = useState<{
    action: "download" | "share" | "delete";
    document: Document;
  } | null>(null);

  const [signDocumentParam] = useQueryState("sign");
  const [signDocumentId, setSignDocumentId] = useState<string | null>(null);
  const isSignable = (document: Document): document is SignableDocument =>
    document.signatories.some(
      (signatory) =>
        !signatory.signedAt &&
        (signatory.id === user.id || (signatory.title === "Company Representative" && isCompanyRepresentative)),
    );
  const signDocument = signDocumentId
    ? documents.find((document): document is SignableDocument => document.id === signDocumentId && isSignable(document))
    : null;
  useEffect(() => {
    const document = signDocumentParam ? documents.find((document) => document.id === signDocumentParam) : null;
    if (canSign && document && isSignable(document)) setSignDocumentId(document.id);
  }, [documents, signDocumentParam]);
  useEffect(() => {
    const downloadUrl = documentAction?.action === "download" ? getDownloadUrl(documentAction.document) : null;
    if (downloadUrl) window.location.href = downloadUrl;
  }, [documentAction]);

  const columns = useMemo(
    () =>
      [
        columnHelper.simple("name", "Document"),
        columnHelper.accessor((row) => typeLabels[row.type], {
          header: "Type",
          meta: { filterOptions: [...new Set(documents.map((document) => typeLabels[document.type]))] },
        }),
        columnHelper.accessor("createdAt", {
          header: "Date",
          cell: (info) => formatDate(info.getValue()),
          meta: {
            filterOptions: [...new Set(documents.map((document) => document.createdAt.getFullYear().toString()))],
          },
          filterFn: (row, _, filterValue) =>
            Array.isArray(filterValue) && filterValue.includes(row.original.createdAt.getFullYear().toString()),
        }),
        isCompanyRepresentative
          ? columnHelper.accessor(
              (row) => {
                const signer = row.signatories.find((signatory) => signatory.title !== "Company Representative");
                return signer?.name || "-";
              },
              { header: "Signer" },
            )
          : null,
        columnHelper.accessor((row) => getStatus(row).name, {
          header: "Status",
          meta: { filterOptions: [...new Set(documents.map((document) => getStatus(document).name))] },
          cell: (info) => {
            const { variant, text } = getStatus(info.row.original);
            return <Status variant={variant}>{text}</Status>;
          },
        }),
        columnHelper.display({
          id: "actions",
          cell: (info) => {
            const document = info.row.original;
            return (
              <>
                {isSignable(document) ? (
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => setSignDocumentId(document.id)}
                    disabled={!canSign}
                  >
                    Review and sign
                  </Button>
                ) : null}

                {!getCompletedAt(document) && isCompanyRepresentative ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="small">
                        <EllipsisVertical className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="border-muted w-44 rounded-md border bg-white p-0 text-sm shadow-sm"
                    >
                      <Button
                        variant="ghost"
                        size="small"
                        className="w-full justify-start"
                        onClick={() => setDocumentAction({ action: "download", document })}
                      >
                        <Download className="size-4" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        className="w-full justify-start"
                        onClick={() => setDocumentAction({ action: "share", document })}
                      >
                        <UserPlus className="size-4" />
                        Share
                      </Button>
                      <div className="border-muted rounded-md border-t shadow-sm" />
                      <Button
                        variant="ghost"
                        size="small"
                        className="w-full justify-start"
                        onClick={() => setDocumentAction({ action: "delete", document })}
                      >
                        <Trash2Icon className="size-4" />
                        Delete
                      </Button>
                    </PopoverContent>
                  </Popover>
                ) : document.signatories.every((signatory) => signatory.signedAt) ? (
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => setDocumentAction({ action: "download", document })}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                ) : null}
              </>
            );
          },
        }),
      ].filter((column) => !!column),
    [userId],
  );
  const storedColumnFilters = columnFiltersSchema.safeParse(
    JSON.parse(localStorage.getItem(storageKeys.DOCUMENTS_COLUMN_FILTERS) ?? "{}"),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    storedColumnFilters.data ?? [{ id: "Status", value: ["Signature required"] }],
  );
  const table = useTable({
    columns,
    data: documents,
    initialState: { sorting: [{ id: "createdAt", desc: true }] },
    state: { columnFilters },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: (columnFilters) =>
      setColumnFilters((old) => {
        const value = typeof columnFilters === "function" ? columnFilters(old) : columnFilters;
        localStorage.setItem(storageKeys.DOCUMENTS_COLUMN_FILTERS, JSON.stringify(value));
        return value;
      }),
  });

  const filingDueDateFor1099DIV = new Date(currentYear, 2, 31);

  return (
    <>
      <DashboardHeader
        title="Documents"
        headerActions={
          <>
            {isCompanyRepresentative && documents.length === 0 ? <NewDocument /> : null}
            {user.roles.administrator && company.flags.includes("lawyers") ? (
              <Button onClick={() => setShowInviteModal(true)}>
                <BriefcaseBusiness className="size-4" />
                Invite lawyer
              </Button>
            ) : null}
          </>
        }
      />

      {!canSign || (user.roles.administrator && new Date() <= filingDueDateFor1099DIV) ? (
        <div className="grid gap-4">
          {!canSign && (
            <Alert className="mx-4">
              <Info className="size-4" />
              <AlertDescription>
                Please{" "}
                <Link className={linkClasses} href="/settings/tax">
                  provide your legal details
                </Link>{" "}
                before signing documents.
              </AlertDescription>
            </Alert>
          )}
          {user.roles.administrator && new Date() <= filingDueDateFor1099DIV ? (
            <Alert className="mx-4">
              <AlertTitle>Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S</AlertTitle>
              <AlertDescription>
                We will submit form 1099-NEC to the IRS on {formatDate(new Date(currentYear, 0, 31))}, form 1042-S on{" "}
                {formatDate(new Date(currentYear, 2, 15))}, and form 1099-DIV on {formatDate(filingDueDateFor1099DIV)}.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : documents.length > 0 ? (
        <>
          <DataTable
            table={table}
            actions={isCompanyRepresentative ? <NewDocument /> : undefined}
            {...(isCompanyRepresentative && { searchColumn: "Signer" })}
          />
          {signDocument ? <SignDocumentModal document={signDocument} onClose={() => setSignDocumentId(null)} /> : null}
        </>
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>No documents yet.</Placeholder>
        </div>
      )}

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who's joining?</DialogTitle>
          </DialogHeader>
          <Form {...inviteLawyerForm}>
            <form onSubmit={(e) => void submitInviteLawyer(e)}>
              <FormField
                control={inviteLawyerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <MutationStatusButton
                type="submit"
                mutation={inviteLawyer}
                className="mt-4 w-full"
                loadingText="Inviting..."
              >
                <SendHorizontal className="size-5" />
                Invite
              </MutationStatusButton>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {forceWorkerOnboarding ? <FinishOnboarding handleComplete={() => setForceWorkerOnboarding(false)} /> : null}
      {documentAction?.action === "share" && (
        <ShareDocumentModal document={documentAction.document} onClose={() => setDocumentAction(null)} />
      )}
      {documentAction?.action === "delete" && (
        <DeleteDocumentModal document={documentAction.document} onClose={() => setDocumentAction(null)} />
      )}
    </>
  );
}

const ShareDocumentModal = ({ document, onClose }: { document: Document; onClose: () => void }) => {
  const company = useCurrentCompany();

  const { data: recipients } = trpc.contractors.list.useQuery(
    company.id ? { companyId: company.id, excludeAlumni: true } : skipToken,
  );
  const [selectedRecipient, setSelectedRecipient] = useState(recipients?.[0] ?? null);

  const queryClient = useQueryClient();

  const shareDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipient) throw new Error("Recipient is required");

      await request({
        url: share_company_document_path(company.id, document.id),
        method: "POST",
        jsonData: { recipient: selectedRecipient.id },
        assertOk: true,
        accept: "json",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>Select who are you sharing "{document.name}" with.</DialogDescription>
        </DialogHeader>
        {document.textContent ? (
          <div
            className="prose border-muted min-h-0 grow overflow-y-auto rounded-md border p-4 text-black"
            dangerouslySetInnerHTML={{ __html: document.textContent ?? "" }}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label className="mt-4">Select recipient</Label>
          <ComboBox
            value={selectedRecipient?.id}
            options={
              recipients
                ? recipients.map((r) => ({
                    value: r.id,
                    label: r.user.name,
                  }))
                : []
            }
            aria-label="Recipient"
            onChange={(value) => setSelectedRecipient(recipients?.find((r) => r.id === value) ?? null)}
          />
        </div>

        <DialogFooter>
          <div className="flex flex-col gap-2">
            {shareDocumentMutation.error ? <p className="text-red-500">{shareDocumentMutation.error.message}</p> : null}
            <MutationButton
              mutation={shareDocumentMutation}
              loadingText="Sharing..."
              onClick={() => shareDocumentMutation.mutate()}
              className="w-[200px] self-end"
            >
              Share Document
            </MutationButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteDocumentModal = ({ document, onClose }: { document: Document; onClose: () => void }) => {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        url: company_document_path(company.id, document.id),
        method: "DELETE",
        assertOk: true,
        accept: "json",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete document");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>Are you sure you want to delete the document "{document.name}"?</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <>
            <Button variant="outline" size="small" onClick={onClose}>
              Cancel
            </Button>

            <MutationButton
              mutation={deleteDocumentMutation}
              loadingText="Deleting..."
              onClick={() => deleteDocumentMutation.mutate()}
            >
              Delete
            </MutationButton>
          </>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SignDocumentModal = ({ document, onClose }: { document: SignableDocument; onClose: () => void }) => {
  const uid = useId();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [signature, setSignature] = useState(user.legalName);

  const queryClient = useQueryClient();

  const signDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!signature) throw new Error("Signature is required");

      const response = await request({
        url: sign_company_document_path(company.id, document.id),
        method: "POST",
        jsonData: {
          title: document.signatories.find((signatory) => signatory.id === user.id)?.title ?? "Company Representative",
        },
        assertOk: true,
        accept: "json",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to sign document");
      }
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
        </DialogHeader>
        <div>
          This information will be used in the W-9 form to confirm your U.S. taxpayer status. If you're eligible for
          1099 forms, you'll receive a download link by email when it's ready.
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpRightFromSquare className="size-4" />
          <a
            target="_blank"
            rel="noopener noreferrer nofollow"
            href="https://www.irs.gov/forms-pubs/about-form-w-9"
            className={linkClasses}
          >
            Official W-9 instructions
          </a>
        </div>

        {document.textContent ? (
          <div
            className="prose border-muted min-h-0 grow overflow-y-auto rounded-md border p-4 text-black"
            dangerouslySetInnerHTML={{ __html: document.textContent ?? "" }}
          />
        ) : (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded bg-red-50">
                <span className="text-xs font-medium text-red-500">
                  {document.name.split(".").pop()?.toUpperCase() || "PDF"}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium">{document.name}</div>
                <div className="text-xs text-gray-500">{typeLabels[document.type]}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={uid}>Your signature</Label>
          <Input
            id={uid}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className="font-signature text-xl"
            aria-label="Signature"
          />
          <p className="text-muted-foreground text-xs">
            I agree that the signature will be the electronic representation of my signature and for all purposes when I
            use them on documents just the same as a pen-and-paper signature.
          </p>
        </div>

        <DialogFooter>
          <div className="flex w-full flex-col gap-2">
            {signDocumentMutation.error ? <p className="text-red-500">{signDocumentMutation.error.message}</p> : null}
            <MutationButton
              mutation={signDocumentMutation}
              loadingText="Saving..."
              disabled={!signature}
              onClick={() => signDocumentMutation.mutate()}
            >
              Agree & Submit
            </MutationButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
