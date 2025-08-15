"use client";
import { skipToken, useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { BriefcaseBusiness, CircleCheck, Download, Info, SendHorizontal } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { FinishOnboarding } from "@/app/(dashboard)/documents/FinishOnboarding";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, filterValueSchema, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import RichText from "@/components/RichText";
import Status, { type Variant as StatusVariant } from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { storageKeys } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { DocumentType, trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatDate } from "@/utils/time";

type Document = RouterOutput["documents"]["list"][number];
type SignableDocument = Document & { text: string };

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

const inviteLawyerSchema = z.object({
  email: z.string().email(),
});

export default function DocumentsPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const isCompanyRepresentative = !!user.roles.administrator || !!user.roles.lawyer;
  const userId = isCompanyRepresentative ? null : user.id;
  const canSign = user.address.street_address || isCompanyRepresentative;
  const isMobile = useIsMobile();

  const [forceWorkerOnboarding, setForceWorkerOnboarding] = useState<boolean>(
    user.roles.worker ? !user.roles.worker.role : false,
  );

  const currentYear = new Date().getFullYear();
  const { data: documents = [], isLoading } = trpc.documents.list.useQuery({ companyId: company.id, userId });

  const columnHelper = createColumnHelper<Document>();
  const [downloadDocument, setDownloadDocument] = useState<bigint | null>(null);
  const { data: downloadUrl } = trpc.documents.getUrl.useQuery(
    downloadDocument ? { companyId: company.id, id: downloadDocument } : skipToken,
  );
  const [signDocumentParam] = useQueryState("sign");
  const [signDocumentId, setSignDocumentId] = useState<bigint | null>(null);
  const isSignable = (document: Document): document is SignableDocument =>
    !!document.docusealSubmissionId &&
    document.signatories.some(
      (signatory) =>
        !signatory.signedAt &&
        (signatory.id === user.id || (signatory.title === "Company Representative" && isCompanyRepresentative)),
    );
  const signDocument = signDocumentId
    ? documents.find((document): document is SignableDocument => document.id === signDocumentId && isSignable(document))
    : null;
  useEffect(() => {
    const document = signDocumentParam ? documents.find((document) => document.id === BigInt(signDocumentParam)) : null;
    if (canSign && document && isSignable(document)) setSignDocumentId(document.id);
  }, [documents, signDocumentParam]);
  useEffect(() => {
    if (downloadUrl) window.location.href = downloadUrl;
  }, [downloadUrl]);

  const desktopColumns = useMemo(
    () =>
      [
        isCompanyRepresentative
          ? columnHelper.accessor(
              (row) =>
                assertDefined(row.signatories.find((signatory) => signatory.title !== "Company Representative")).name,
              { id: "signer", header: "Signer" },
            )
          : null,
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
        columnHelper.accessor((row) => getStatus(row).name, {
          id: "status",
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
                {document.attachment ? (
                  <Button variant="outline" size="small" asChild>
                    <Link href={`/download/${document.attachment.key}/${document.attachment.filename}`} download>
                      <Download className="size-4" />
                      Download
                    </Link>
                  </Button>
                ) : document.docusealSubmissionId && document.signatories.every((signatory) => signatory.signedAt) ? (
                  <Button variant="outline" size="small" onClick={() => setDownloadDocument(document.id)}>
                    <Download className="size-4" />
                    Download
                  </Button>
                ) : null}
              </>
            );
          },
        }),
      ].filter((column) => !!column),
    [documents, isCompanyRepresentative, isSignable, canSign, setSignDocumentId, setDownloadDocument],
  );

  const mobileColumns = useMemo(
    () =>
      [
        columnHelper.display({
          id: "documentNameSigner",
          cell: (info) => (
            <div className="flex flex-col gap-1">
              <div className="text-base font-medium">{info.row.original.name}</div>
              {isCompanyRepresentative ? (
                <div className="text-sm font-normal">
                  {
                    info.row.original.signatories.find((signatory) => signatory.title !== "Company Representative")
                      ?.name
                  }
                </div>
              ) : null}
            </div>
          ),
          meta: {
            cellClassName: "w-full",
          },
        }),

        columnHelper.display({
          id: "statusSentOn",
          cell: (info) => {
            const document = info.row.original;
            const { variant } = getStatus(info.row.original);

            return (
              <div className="flex h-full flex-col items-end justify-between">
                <div className="flex h-5 w-4 items-center justify-center">
                  <Status variant={variant} />
                </div>
                <div className="text-gray-600">{formatDate(document.createdAt)}</div>
              </div>
            );
          },
        }),

        columnHelper.accessor((row) => getStatus(row).name, {
          id: "status",
          meta: { filterOptions: [...new Set(documents.map((document) => getStatus(document).name))], hidden: true },
        }),
        isCompanyRepresentative
          ? columnHelper.accessor(
              (row) =>
                assertDefined(row.signatories.find((signatory) => signatory.title !== "Company Representative")).name,
              {
                id: "signer",
                header: "Signer",
                meta: { hidden: true },
              },
            )
          : null,

        columnHelper.accessor("createdAt", {
          id: "createdAt",
          header: "Date",
          cell: (info) => formatDate(info.getValue()),
          meta: {
            filterOptions: [...new Set(documents.map((document) => document.createdAt.getFullYear().toString()))],
            hidden: true,
          },
          filterFn: (row, _, filterValue) =>
            Array.isArray(filterValue) && filterValue.includes(row.original.createdAt.getFullYear().toString()),
        }),

        columnHelper.accessor((row) => typeLabels[row.type], {
          header: "Type",
          meta: { filterOptions: [...new Set(documents.map((document) => typeLabels[document.type]))], hidden: true },
        }),
      ].filter((column) => !!column),
    [documents, isCompanyRepresentative],
  );

  const columns = isMobile ? mobileColumns : desktopColumns;

  const storedColumnFilters = columnFiltersSchema.safeParse(
    JSON.parse(localStorage.getItem(storageKeys.DOCUMENTS_COLUMN_FILTERS) ?? "{}"),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    storedColumnFilters.data ?? [{ id: "status", value: ["Signature required"] }],
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
          user.roles.administrator && company.flags.includes("lawyers") ? (
            <Button onClick={() => setShowInviteModal(true)}>
              <BriefcaseBusiness className="size-4" />
              Invite lawyer
            </Button>
          ) : null
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
          <DataTable table={table} {...(isCompanyRepresentative && { searchColumn: "Signer" })} />
          {signDocument ? <SignDocumentModal document={signDocument} onClose={() => setSignDocumentId(null)} /> : null}
        </>
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>No documents yet.</Placeholder>
        </div>
      )}
      {forceWorkerOnboarding ? <FinishOnboarding handleComplete={() => setForceWorkerOnboarding(false)} /> : null}
    </>
  );
}

const SignDocumentModal = ({ document, onClose }: { document: SignableDocument; onClose: () => void }) => {
  const company = useCurrentCompany();
  const [redirectUrl] = useQueryState("next");
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const queryClient = useQueryClient();

  const signDocument = trpc.documents.sign.useMutation({
    onSuccess: async () => {
      router.replace("/documents");
      await trpcUtils.documents.list.refetch();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- not ideal, but there's no good way to assert this right now
      if (redirectUrl) router.push(redirectUrl as Route);
      else onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-100 overflow-y-auto rounded-md border p-2">
          <RichText content={document.text} />
        </div>
      </DialogContent>
      <DialogFooter>
        <MutationButton
          type="submit"
          mutation={signDocument}
          className="mt-4 w-full"
          loadingText="Signing..."
          param={{ companyId: company.id, id: document.id, role: "Company Representative" }}
        >
          Agree & Submit
        </MutationButton>
      </DialogFooter>
    </Dialog>
  );
};
