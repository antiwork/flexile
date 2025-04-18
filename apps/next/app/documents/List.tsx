import { ArrowDownTrayIcon } from "@heroicons/react/16/solid";
import { skipToken } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import Status from "@/components/Status";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { DocumentType, trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatDate } from "@/utils/time";
import DocusealForm from "./DocusealForm";

const typeLabels = {
  [DocumentType.ConsultingContract]: "Agreement",
  [DocumentType.ShareCertificate]: "Certificate",
  [DocumentType.TaxDocument]: "Tax form",
  [DocumentType.ExerciseNotice]: "Exercise notice",
  [DocumentType.EquityPlanContract]: "Equity plan",
  [DocumentType.BoardConsent]: "Board consent",
};

type Document = RouterOutput["documents"]["list"][number];

function DocumentStatus({ document }: { document: Document }) {
  const completedAt = document.signatories.every((signatory) => signatory.signedAt)
    ? document.signatories.reduce<Date | null>(
        (acc, signatory) =>
          acc ? (signatory.signedAt && signatory.signedAt > acc ? signatory.signedAt : acc) : signatory.signedAt,
        null,
      )
    : undefined;

  switch (document.type) {
    case DocumentType.TaxDocument:
      if (document.name.startsWith("W-") || completedAt) {
        return <Status variant="success">{completedAt ? `Filed on ${formatDate(completedAt)}` : "Signed"}</Status>;
      }
      return <Status>Ready for filing</Status>;
    case DocumentType.ShareCertificate:
    case DocumentType.ExerciseNotice:
      return <Status variant="success">Issued</Status>;
    case DocumentType.BoardConsent:
    case DocumentType.ConsultingContract:
    case DocumentType.EquityPlanContract:
      if (document.type === DocumentType.BoardConsent && !document.lawyerApproved) {
        return <Status variant="secondary">Waiting approval</Status>;
      }

      return completedAt ? (
        <Status variant="success">Signed</Status>
      ) : (
        <Status variant="critical">Signature required</Status>
      );
  }
}

type SignableDocument = Document & { docusealSubmissionId: number };
const List = ({ userId, documents }: { userId: string | null; documents: Document[] }) => {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const columnHelper = createColumnHelper<Document>();
  const [downloadDocument, setDownloadDocument] = useState<bigint | null>(null);
  const { data: downloadUrl } = trpc.documents.getUrl.useQuery(
    downloadDocument ? { companyId: company.id, id: downloadDocument } : skipToken,
  );
  const [signDocumentParam] = useQueryState("sign");
  const [signDocumentId, setSignDocumentId] = useState<bigint | null>(null);
  const isSignable = (document: Document): document is SignableDocument => {
    if (document.type === DocumentType.BoardConsent && !document.lawyerApproved) {
      return false;
    }

    if (
      document.type === DocumentType.BoardConsent &&
      user.activeRole === "administrator" &&
      !user.roles.administrator?.isBoardMember
    ) {
      return false;
    }

    return !!document.docusealSubmissionId && document.signatories.some((signatory) => !signatory.signedAt);
  };
  const isLawyerApprovable = (document: Document): document is SignableDocument =>
    document.type === DocumentType.BoardConsent && !document.lawyerApproved;
  const signDocument = signDocumentId
    ? documents.find(
        (document): document is SignableDocument =>
          document.id === signDocumentId && (isSignable(document) || isLawyerApprovable(document)),
      )
    : null;
  useEffect(() => {
    const document = signDocumentParam ? documents.find((document) => document.id === BigInt(signDocumentParam)) : null;
    if (document && (isSignable(document) || isLawyerApprovable(document))) setSignDocumentId(document.id);
  }, [documents, signDocumentParam]);
  useEffect(() => {
    if (downloadUrl) window.location.href = downloadUrl;
  }, [downloadUrl]);
  const columns = useMemo(
    () =>
      [
        userId && user.activeRole === "contractorOrInvestor"
          ? null
          : columnHelper.display({
              header: "Signer",
              cell: (info) =>
                assertDefined(
                  info.row.original.signatories.find((signatory) => signatory.title !== "Company Representative"),
                ).name,
            }),
        columnHelper.simple("name", "Document"),
        columnHelper.simple("type", "Type", (value) => typeLabels[value]),
        columnHelper.simple("createdAt", "Date", formatDate),
        columnHelper.display({
          header: "Status",
          cell: (info) => <DocumentStatus document={info.row.original} />,
        }),
        columnHelper.display({
          id: "actions",
          cell: (info) => {
            const document = info.row.original;

            if (
              document.type === DocumentType.BoardConsent &&
              user.activeRole === "lawyer" &&
              !document.lawyerApproved
            ) {
              return (
                <Button variant="outline" size="small" onClick={() => setSignDocumentId(document.id)}>
                  Approve
                </Button>
              );
            }

            return (
              <>
                {isSignable(document) ? (
                  <Button variant="outline" size="small" onClick={() => setSignDocumentId(document.id)}>
                    Review & sign
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

  const table = useTable({ columns, data: documents });

  return (
    <>
      <DataTable table={table} />
      {signDocument ? <SignDocumentModal document={signDocument} onClose={() => setSignDocumentId(null)} /> : null}
    </>
  );
};

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
    <Modal open onClose={onClose}>
      {user.activeRole === "lawyer" && document.type === DocumentType.BoardConsent && (
        <header className="flex justify-end gap-4">
          <MutationButton
            mutation={documentLawyerApproval}
            param={{ companyId: company.id, id: document.id }}
            loadingText="Approving..."
            successText="Approved!"
            errorText="Failed to approve"
          >
            Approve
          </MutationButton>
        </header>
      )}
      <DocusealForm
        src={`https://docuseal.com/s/${slug}`}
        readonlyFields={readonlyFields}
        preview={user.activeRole === "lawyer" && document.type === DocumentType.BoardConsent}
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
    </Modal>
  );
};

export default List;
