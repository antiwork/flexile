"use client";
import { useQueryClient } from "@tanstack/react-query";
import { type ColumnFiltersState, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { CircleCheck, Download, Info, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { FinishOnboarding } from "@/app/(dashboard)/documents/FinishOnboarding";
import { getAvailableActions, SelectionActions } from "@/components/actions/SelectionActions";
import type { ActionConfig, ActionContext, AvailableActions } from "@/components/actions/types";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, filterValueSchema, useTable } from "@/components/DataTable";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import SignForm from "@/components/SignForm";
import Status, { type Variant as StatusVariant } from "@/components/Status";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { storageKeys } from "@/models/constants";
import type { RouterOutput } from "@/trpc";
import { DocumentType, trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";

type Document = RouterOutput["documents"]["list"][number];

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

export default function DocumentsPage() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const isCompanyRepresentative = !!user.roles.administrator || !!user.roles.lawyer;
  const userId = isCompanyRepresentative ? null : user.id;
  const canSign = user.address.street_address || isCompanyRepresentative;
  const isMobile = useIsMobile();

  const contractorIncomplete = user.roles.worker ? !user.roles.worker.role : false;
  const [forceWorkerOnboarding, setForceWorkerOnboarding] = useState<boolean>(contractorIncomplete);

  const currentYear = new Date().getFullYear();
  const { data: documents = [], isLoading } = trpc.documents.list.useQuery({ companyId: company.id, userId });

  const columnHelper = createColumnHelper<Document>();
  const [signDocumentParam] = useQueryState("sign");
  const [signDocumentId, setSignDocumentId] = useState<bigint | null>(null);
  const isSignable = (document: Document) =>
    document.hasText &&
    document.signatories.some(
      (signatory) =>
        !signatory.signedAt &&
        (signatory.id === user.id || (signatory.title === "Company Representative" && isCompanyRepresentative)),
    );
  const signDocument = signDocumentId
    ? documents.find((document) => document.id === signDocumentId && isSignable(document))
    : null;
  useEffect(() => {
    const document = signDocumentParam ? documents.find((document) => document.id === BigInt(signDocumentParam)) : null;
    if (canSign && document && isSignable(document)) setSignDocumentId(document.id);
  }, [documents, signDocumentParam]);

  const actionConfig = useMemo(
    (): ActionConfig<Document> => ({
      entityName: "documents",
      actions: {
        reviewAndSign: {
          id: "reviewAndSign",
          label: "Review and sign",
          icon: () => null,
          variant: "primary",
          contexts: ["single"],
          permissions: ["administrator", "worker"],
          conditions: (document: Document): boolean => !!isSignable(document) && !!canSign,
          action: "reviewAndSign",
          group: "signature",
          showIn: ["selection"],
        },
        download: {
          id: "download",
          label: "Download",
          icon: Download,
          contexts: ["single"],
          permissions: ["administrator", "worker"],
          conditions: (document: Document): boolean => !!document.attachment,
          href: (document: Document) => `/download/${document.attachment?.key}/${document.attachment?.filename}`,
          group: "file",
          showIn: ["both"],
        },
      },
    }),
    [isSignable, canSign, isCompanyRepresentative],
  );

  const actionContext = useMemo(
    (): ActionContext => ({
      userRole: isCompanyRepresentative ? "administrator" : "worker",
      permissions: {},
    }),
    [isCompanyRepresentative],
  );

  const handleAction = (actionId: string, documents: Document[]) => {
    const singleDocument = documents[0];
    if (!singleDocument) return;

    if (actionId === "reviewAndSign") setSignDocumentId(singleDocument.id);
  };

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
      ].filter((column) => !!column),
    [documents, isCompanyRepresentative, isSignable, canSign, setSignDocumentId],
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
                <div className="text-base font-normal">
                  {
                    info.row.original.signatories.find((signatory) => signatory.title !== "Company Representative")
                      ?.name
                  }
                </div>
              ) : (
                <div className="text-base font-normal">{typeLabels[info.row.original.type]}</div>
              )}
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
            const { variant, text } = getStatus(document);

            return (
              <div className="flex h-full flex-col items-end justify-between gap-1">
                <Status variant={variant}>{text}</Status>
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
    getRowId: (document) => document.id.toString(),
    initialState: { sorting: [{ id: "createdAt", desc: true }] },
    state: { columnFilters },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    onColumnFiltersChange: (columnFilters) =>
      setColumnFilters((old) => {
        const value = typeof columnFilters === "function" ? columnFilters(old) : columnFilters;
        localStorage.setItem(storageKeys.DOCUMENTS_COLUMN_FILTERS, JSON.stringify(value));
        return value;
      }),
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedDocuments = selectedRows.map((row) => row.original);
  const availableActions = useMemo(
    () => getAvailableActions(selectedDocuments, actionConfig, actionContext),
    [selectedDocuments, actionConfig, actionContext],
  );

  const filingDueDateFor1099DIV = new Date(currentYear, 2, 31);

  return (
    <>
      <DashboardHeader
        title="Documents"
        headerActions={
          isMobile && table.options.enableRowSelection ? (
            <button
              className="text-blue-600"
              onClick={() => table.toggleAllRowsSelected(!table.getIsAllRowsSelected())}
            >
              {table.getIsAllRowsSelected() ? "Unselect all" : "Select all"}
            </button>
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

      {contractorIncomplete ? (
        <Alert className="mx-4">
          <Info className="size-4" />
          <AlertDescription>
            You've joined {company.name} as a contractor. We need some information to&nbsp;
            <Button variant="link" className="underline" onClick={() => setForceWorkerOnboarding(true)}>
              complete your onboarding
            </Button>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : documents.length > 0 ? (
        <>
          <DataTable
            table={table}
            tabsColumn="status"
            {...(isCompanyRepresentative && { searchColumn: "signer" })}
            selectionActions={(selectedDocuments) => (
              <SelectionActions
                selectedItems={selectedDocuments}
                config={actionConfig}
                availableActions={availableActions}
                onAction={handleAction}
              />
            )}
          />
          {isMobile ? (
            <DocumentBulkActionsBar
              availableActions={availableActions}
              selectedDocuments={selectedDocuments}
              onClose={() => table.toggleAllRowsSelected(false)}
              onAction={handleAction}
            />
          ) : null}
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

const SignDocumentModal = ({ document, onClose }: { document: Document; onClose: () => void }) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [redirectUrl] = useQueryState("next");
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [data] = trpc.documents.get.useSuspenseQuery({ companyId: company.id, id: document.id });
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
  const [signed, setSigned] = useState(false);
  const sign = () => {
    signDocument.mutate({
      companyId: company.id,
      id: document.id,
      role: document.signatories.find((signatory) => signatory.id === user.id)?.title ?? "Company Representative",
    });
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
        </DialogHeader>
        <SignForm content={data.text ?? ""} signed={signed} onSign={() => setSigned(true)} />
        <DialogFooter>
          <Button size="small" onClick={sign} disabled={!signed}>
            Agree & Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DocumentBulkActionsBar = ({
  selectedDocuments,
  onClose,
  availableActions,
  onAction,
}: {
  selectedDocuments: Document[];
  onClose: () => void;
  availableActions: AvailableActions<Document>[];
  onAction: (actionId: string, items: Document[]) => void;
}) => {
  const [visibleDocuments, setVisibleDocuments] = useState<Document[]>([]);
  const [visibleActions, setVisibleActions] = useState<AvailableActions<Document>[]>([]);

  useEffect(() => {
    const isOpen = selectedDocuments.length > 0;
    if (isOpen) {
      setVisibleDocuments(selectedDocuments);
      setVisibleActions(availableActions);
    }
  }, [selectedDocuments, availableActions]);

  const rowsSelected = visibleDocuments.length;
  const downloadAction = visibleActions.find((action) => action.key === "download");
  const signAction = visibleActions.find((action) => action.key === "reviewAndSign");
  const singleDocument = rowsSelected === 1 ? visibleDocuments[0] : undefined;

  return (
    <Dialog open={selectedDocuments.length > 0} modal={false}>
      <DialogContent
        className="border-border fixed right-auto bottom-16 left-1/2 w-auto -translate-x-1/2 transform rounded-xl border p-0"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Selected documents</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 p-2">
          <Button
            variant="outline"
            className="border-muted flex h-9 items-center gap-2 rounded-lg border border-dashed text-sm font-medium hover:bg-white"
            onClick={onClose}
          >
            <span className="tabular-nums">{rowsSelected}</span> selected
            <X className="size-4" />
          </Button>
          {downloadAction && downloadAction.href && singleDocument ? (
            <Button variant="outline" className="flex h-9 items-center gap-2 text-sm" asChild>
              <Link href={{ pathname: downloadAction.href(singleDocument) }}>
                <Download className="size-3.5" strokeWidth={2.5} />
                Download
              </Link>
            </Button>
          ) : null}
          {signAction ? (
            <Button
              variant="primary"
              className="flex h-9 items-center gap-2 text-sm"
              onClick={() => signAction.action && onAction(signAction.action, selectedDocuments)}
            >
              Review and sign
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
