"use client";
import { ArrowDownTrayIcon, InformationCircleIcon } from "@heroicons/react/16/solid";
import { BriefcaseIcon, CheckCircleIcon, PaperAirplaneIcon, PencilIcon } from "@heroicons/react/24/outline";
import { skipToken } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { FileTextIcon, GavelIcon, PercentIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import DocusealForm, { customCss } from "@/app/documents/DocusealForm";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status, { type Variant as StatusVariant } from "@/components/Status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { DocumentTemplateType, DocumentType, trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatDate } from "@/utils/time";
import { linkClasses } from "@/components/Link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type Document = RouterOutput["documents"]["list"][number];
type SignableDocument = Document & { docusealSubmissionId: number };

const typeLabels = {
  [DocumentType.ConsultingContract]: "Agreement",
  [DocumentType.ShareCertificate]: "Certificate",
  [DocumentType.TaxDocument]: "Tax form",
  [DocumentType.ExerciseNotice]: "Exercise notice",
  [DocumentType.EquityPlanContract]: "Equity plan",
  [DocumentType.BoardConsent]: "Board consent",
};

const templateTypeLabels = {
  [DocumentTemplateType.ConsultingContract]: "Agreement",
  [DocumentTemplateType.EquityPlanContract]: "Equity plan",
  [DocumentTemplateType.BoardConsent]: "Board consent",
};

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
    case DocumentType.BoardConsent:
    case DocumentType.ConsultingContract:
    case DocumentType.EquityPlanContract:
      if (document.type === DocumentType.BoardConsent && !document.lawyerApproved) {
        return { variant: "secondary", name: "Awaiting approval", text: "Awaiting approval" };
      }
      return completedAt
        ? { variant: "success", name: "Signed", text: "Signed" }
        : { variant: "critical", name: "Signature required", text: "Signature required" };
  }
}

const EditTemplates = () => {
  const company = useCurrentCompany();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [templates, { refetch: refetchTemplates }] = trpc.documents.templates.list.useSuspenseQuery({
    companyId: company.id,
  });
  const filteredTemplates = useMemo(
    () =>
      company.id && templates.length > 1
        ? templates.filter(
            (template) => !template.generic || !templates.some((t) => !t.generic && t.type === template.type),
          )
        : templates,
    [templates],
  );
  const createTemplate = trpc.documents.templates.create.useMutation({
    onSuccess: (id) => {
      void refetchTemplates();
      router.push(`/document_templates/${id}`);
    },
  });

  return (
    <>
      <Button variant="outline" size="small" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
        Edit templates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit templates</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Link href={`/document_templates/${template.id}`} className="after:absolute after:inset-0">
                        {template.name}
                      </Link>
                    </TableCell>
                    <TableCell>{templateTypeLabels[template.type]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <h3 className="text-lg font-medium">Create a new template</h3>
            <Alert>
              <InformationCircleIcon />
              <AlertDescription>
                By creating a custom document template, you acknowledge that Flexile shall not be liable for any claims,
                liabilities, or damages arising from or related to such documents. See our{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                for more details.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-3 gap-4">
              <MutationButton
                idleVariant="outline"
                className="h-auto rounded-md p-6"
                mutation={createTemplate}
                param={{
                  companyId: company.id,
                  name: "Consulting agreement",
                  type: DocumentTemplateType.ConsultingContract,
                }}
              >
                <div className="flex flex-col items-center">
                  <FileTextIcon className="size-6" />
                  <span className="mt-2 whitespace-normal">Consulting agreement</span>
                </div>
              </MutationButton>
              <MutationButton
                idleVariant="outline"
                className="h-auto rounded-md p-6"
                mutation={createTemplate}
                param={{
                  companyId: company.id,
                  name: "Equity grant contract",
                  type: DocumentTemplateType.EquityPlanContract,
                }}
              >
                <div className="flex flex-col items-center">
                  <PercentIcon className="size-6" />
                  <span className="mt-2 whitespace-normal">Equity grant contract</span>
                </div>
              </MutationButton>
              <MutationButton
                idleVariant="outline"
                className="h-auto rounded-md p-6"
                mutation={createTemplate}
                param={{
                  companyId: company.id,
                  name: "Option grant board consent",
                  type: DocumentTemplateType.BoardConsent,
                }}
              >
                <div className="flex flex-col items-center">
                  <GavelIcon className="size-6" />
                  <span className="mt-2 whitespace-normal">Option grant board consent</span>
                </div>
              </MutationButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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

  const currentYear = new Date().getFullYear();
  const [documents] = trpc.documents.list.useSuspenseQuery({ companyId: company.id, userId });

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
  const [downloadDocument, setDownloadDocument] = useState<bigint | null>(null);
  const { data: downloadUrl } = trpc.documents.getUrl.useQuery(
    downloadDocument ? { companyId: company.id, id: downloadDocument } : skipToken,
  );
  const [signDocumentParam] = useQueryState("sign");
  const [signDocumentId, setSignDocumentId] = useState<bigint | null>(null);
  const isSignable = (document: Document): document is SignableDocument => {
    if (document.type === DocumentType.BoardConsent && !document.lawyerApproved && !user.roles.lawyer) return false;

    return (
      !!document.docusealSubmissionId &&
      document.signatories.some(
        (signatory) =>
          !signatory.signedAt &&
          (signatory.id === user.id ||
            ((signatory.title === "Company Representative" || signatory.title === "Board member") &&
              isCompanyRepresentative)),
      )
    );
  };
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

  const columns = useMemo(
    () =>
      [
        isCompanyRepresentative
          ? columnHelper.accessor(
              (row) =>
                assertDefined(row.signatories.find((signatory) => signatory.title !== "Company Representative")).name,
              { header: "Signer" },
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
                    {document.type === DocumentType.BoardConsent && !document.lawyerApproved
                      ? "Approve"
                      : "Review and sign"}
                  </Button>
                ) : null}
                {document.attachment ? (
                  <Button variant="outline" size="small" asChild>
                    <a href={document.attachment} download>
                      <ArrowDownTrayIcon className="size-4" />
                      Download
                    </a>
                  </Button>
                ) : document.docusealSubmissionId && document.signatories.every((signatory) => signatory.signedAt) ? (
                  <Button variant="outline" size="small" onClick={() => setDownloadDocument(document.id)}>
                    <ArrowDownTrayIcon className="size-4" />
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
  const table = useTable({
    columns,
    data: documents,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filingDueDateFor1099DIV = new Date(currentYear, 2, 31);

  return (
    <MainLayout
      title="Documents"
      headerActions={
        <>
          {isCompanyRepresentative && documents.length === 0 ? <EditTemplates /> : null}
          {user.roles.administrator && company.flags.includes("lawyers") ? (
            <Button onClick={() => setShowInviteModal(true)}>
              <BriefcaseIcon className="size-4" />
              Invite lawyer
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4">
        {canSign ? null : (
          <Alert>
            <InformationCircleIcon />
            <AlertDescription>
              Please{" "}
              <Link className={linkClasses} href="/settings/tax">
                provide your legal details
              </Link>{" "}
              before signing documents.
            </AlertDescription>
          </Alert>
        )}
        {company.flags.includes("irs_tax_forms") &&
        user.roles.administrator &&
        new Date() <= filingDueDateFor1099DIV ? (
          <Alert className="mb-4">
            <AlertTitle>Upcoming filing dates for 1099-NEC, 1099-DIV, and 1042-S</AlertTitle>
            <AlertDescription>
              We will submit form 1099-NEC to the IRS on {formatDate(new Date(currentYear, 0, 31))}, form 1042-S on{" "}
              {formatDate(new Date(currentYear, 2, 15))}, and form 1099-DIV on {formatDate(filingDueDateFor1099DIV)}.
            </AlertDescription>
          </Alert>
        ) : null}
        {documents.length > 0 ? (
          <>
            <DataTable
              table={table}
              actions={isCompanyRepresentative ? <EditTemplates /> : undefined}
              {...(isCompanyRepresentative && { searchColumn: "Signer" })}
            />
            {signDocument ? (
              <SignDocumentModal document={signDocument} onClose={() => setSignDocumentId(null)} />
            ) : null}
          </>
        ) : (
          <Placeholder icon={CheckCircleIcon}>No documents yet.</Placeholder>
        )}
      </div>
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
                <PaperAirplaneIcon className="size-5" />
                Invite
              </MutationStatusButton>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

const SignDocumentModal = ({ document, onClose }: { document: SignableDocument; onClose: () => void }) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [redirectUrl] = useQueryState("next");
  const router = useRouter();
  const [{ slug, readonlyFields }] = trpc.documents.templates.getSubmitterSlug.useSuspenseQuery({
    id: document.docusealSubmissionId,
    companyId: company.id,
  });
  const trpcUtils = trpc.useUtils();
  const documentLawyerApproval = trpc.documents.approveByLawyer.useMutation({
    onSuccess: async () => {
      await trpcUtils.documents.list.invalidate();
      router.push("/documents");
      onClose();
    },
  });
  const documentMemberApproval = trpc.documents.approveByMember.useMutation({
    onSuccess: async () => {
      await trpcUtils.documents.list.invalidate();
      router.push("/documents");
      onClose();
    },
  });
  const signDocument = trpc.documents.sign.useMutation({
    onSuccess: async (data) => {
      if (data.complete) {
        documentMemberApproval.mutate({
          companyId: company.id,
          id: data.documentId,
        });
      }
      await trpcUtils.documents.list.refetch();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- not ideal, but there's no good way to assert this right now
      if (redirectUrl) router.push(redirectUrl as Route);
      else onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        {document.type === DocumentType.BoardConsent && !document.lawyerApproved && (
          <DialogHeader>
            <div className="flex justify-end gap-4">
              <MutationButton
                mutation={documentLawyerApproval}
                param={{ companyId: company.id, id: document.id }}
                loadingText="Approving..."
                successText="Approved!"
                errorText="Failed to approve"
              >
                Approve
              </MutationButton>
            </div>
          </DialogHeader>
        )}
        <DocusealForm
          src={`https://docuseal.com/s/${slug}`}
          readonlyFields={readonlyFields}
          preview={document.type === DocumentType.BoardConsent && !document.lawyerApproved}
          customCss={customCss}
          onComplete={() => {
            const userIsSigner = document.signatories.some(
              (signatory) => signatory.id === user.id && signatory.title === "Signer",
            );
            const role = userIsSigner
              ? "Signer"
              : document.type === DocumentType.BoardConsent
                ? assertDefined(
                    document.signatories.find((signatory) => signatory.id === user.id)?.title,
                    "User is not a board member",
                  )
                : "Company Representative";
            signDocument.mutate({
              companyId: company.id,
              id: document.id,
              role,
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
