import { useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";

type Document = RouterOutput["documents"]["list"][number];
type SignableDocument = Document & { docusealSubmissionId: number };

export function useIsDocumentSignable() {
  const user = useCurrentUser();
  const isCompanyRepresentative = user.roles.administrator || user.roles.lawyer;

  return (document: Document): document is SignableDocument => {
    // For badge purposes, we want to show documents that need signatures
    // regardless of whether they have a DocuSeal submission ID yet
    const hasUnsignedSignatories = document.signatories.some(
      (signatory) =>
        !signatory.signedAt &&
        (signatory.id === user.id || (signatory.title === "Company Representative" && isCompanyRepresentative)),
    );

    // Keep the original logic that requires docusealSubmissionId for actual signing
    const hasDocusealId = !!document.docusealSubmissionId;
    const result = hasDocusealId && hasUnsignedSignatories;

    return result;
  };
}

// New function for badge counting that doesn't require docusealSubmissionId
export function useIsDocumentSignatureRequired() {
  const user = useCurrentUser();
  const isCompanyRepresentative = user.roles.administrator || user.roles.lawyer;

  return (document: Document): boolean => {
    const hasUnsignedSignatories = document.signatories.some(
      (signatory) =>
        !signatory.signedAt &&
        (signatory.id === user.id || (signatory.title === "Company Representative" && isCompanyRepresentative)),
    );

    return hasUnsignedSignatories;
  };
}
