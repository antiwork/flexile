import type { Document } from "@/app/(dashboard)/documents/page";
import type { CurrentUser } from "@/models/user";

export const isSignableDocument = (document: Document, user: CurrentUser): boolean =>
  !!document.docusealSubmissionId &&
  document.signatories.some(
    (signatory) =>
      !signatory.signedAt &&
      (signatory.id === user.id ||
        (signatory.title === "Company Representative" &&
          (Boolean(user.roles.administrator) || Boolean(user.roles.lawyer)))),
  );
