import { ArrowDownTrayIcon } from "@heroicons/react/16/solid";
import { skipToken } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Status from "@/components/Status";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { DocumentType, trpc } from "@/trpc/client";
import { formatDate } from "@/utils/time";
import DocusealForm from "./DocusealForm";

const typeLabels = {
  [DocumentType.ConsultingContract]: "Agreement",
  [DocumentType.ShareCertificate]: "Certificate",
  [DocumentType.TaxDocument]: "Tax form",
  [DocumentType.ExerciseNotice]: "Exercise notice",
  [DocumentType.EquityPlanContract]: "Equity plan",
};

type Document = RouterOutput["documents"]["list"]["documents"][number];

function DocumentStatus({ document }: { document: Document }) {
  switch (document.type) {
    case DocumentType.TaxDocument:
      if (document.name.startsWith("W-") || document.completedAt) {
        return (
          <Status variant="success">
            {document.completedAt ? `Filed on ${formatDate(document.completedAt)}` : "Signed"}
          </Status>
        );
      }
      return <Status>Ready for filing</Status>;
    case DocumentType.ShareCertificate:
    case DocumentType.ExerciseNotice:
      return <Status variant="success">Issued</Status>;
    case DocumentType.ConsultingContract:
    case DocumentType.EquityPlanContract:
      return document.completedAt ? (
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
  const isSignable = (document: Document): document is SignableDocument =>
    !!document.docusealSubmissionId &&
    ((document.user.id === user.id && !document.contractorSignature) ||
      (user.activeRole === "administrator" && !document.administratorSignature));
  const signDocument = signDocumentId
    ? documents.find((document): document is SignableDocument => document.id === signDocumentId && isSignable(document))
    : null;
  useEffect(() => {
    const document = signDocumentParam ? documents.find((document) => document.id === BigInt(signDocumentParam)) : null;
    if (document && isSignable(document)) setSignDocumentId(document.id);
  }, [documents, signDocumentParam]);
  useEffect(() => {
    if (downloadUrl) window.location.href = downloadUrl;
  }, [downloadUrl]);
  const columns = useMemo(
    () =>
      [
        userId ? null : columnHelper.accessor("user.name", { header: "Signer" }),
        columnHelper.simple("name", "Document"),
        columnHelper.simple("type", "Type", (value) => typeLabels[value]),
        columnHelper.simple("createdAt", "Date", formatDate),
        columnHelper.accessor("completedAt", {
          header: "Status",
          cell: (info) => <DocumentStatus document={info.row.original} />,
        }),
        columnHelper.display({
          id: "actions",
          cell: (info) => {
            const document = info.row.original;
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
                ) : document.docusealSubmissionId && document.completedAt ? (
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
      <Table table={table} />
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
  const signDocument = trpc.documents.sign.useMutation({
    onSuccess: async () => {
      await trpcUtils.documents.list.refetch();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- not ideal, but there's no good way to assert this right now
      if (redirectUrl) router.push(redirectUrl as Route);
      else onClose();
    },
  });

  return (
    <Modal open onClose={onClose}>
      <DocusealForm
        src={`https://docuseal.com/s/${slug}`}
        readonlyFields={readonlyFields}
        onComplete={() =>
          signDocument.mutate({
            companyId: company.id,
            id: document.id,
            role: document.user.id === user.id && !document.contractorSignature ? "Signer" : "Company Representative",
          })
        }
      />
    </Modal>
  );
};

export default List;
