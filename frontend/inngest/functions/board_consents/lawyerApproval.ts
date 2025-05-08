import docuseal from "@docuseal/api";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { DocumentTemplateType, DocumentType } from "@/db/enums";
import {
  boardConsents,
  companyAdministrators,
  companyInvestors,
  documents,
  documentSignatures,
  documentTemplates,
  users,
} from "@/db/schema";
import { inngest } from "@/inngest/client";

export default inngest.createFunction(
  { id: "lawyer-board-consent-approval" },
  { event: "board-consent.lawyer-approved" },
  async ({ event, step }) => {
    const { boardConsentId, companyId, documentId } = event.data;

    await step.run("generate-equity-plan-contract", async () => {
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.type, DocumentTemplateType.EquityPlanContract),
          or(eq(documentTemplates.companyId, BigInt(companyId)), isNull(documentTemplates.companyId)),
        ),
        orderBy: desc(documentTemplates.createdAt),
      });
      if (!template) throw new NonRetriableError("Equity plan contract template not found");

      const year = new Date().getFullYear();
      const companyAdministrator = await db.query.companyAdministrators.findFirst({
        where: eq(companyAdministrators.companyId, BigInt(companyId)),
        with: {
          user: {
            columns: {
              email: true,
            },
          },
        },
      });
      if (!companyAdministrator) throw new NonRetriableError("Company administrator not found");

      const [companyInvestor] = await db
        .select({
          userId: companyInvestors.userId,
          email: users.email,
        })
        .from(companyInvestors)
        .leftJoin(boardConsents, eq(boardConsents.companyInvestorId, companyInvestors.id))
        .innerJoin(users, eq(users.id, companyInvestors.userId))
        .where(and(eq(boardConsents.id, BigInt(boardConsentId)), eq(companyInvestors.companyId, BigInt(companyId))));
      if (!companyInvestor) throw new NonRetriableError("Company investor not found");

      const boardConsentDocument = await db.query.documents.findFirst({
        where: and(
          eq(documents.id, BigInt(documentId)),
          eq(documents.type, DocumentType.BoardConsent),
          eq(documents.year, year),
        ),
      });
      if (!boardConsentDocument) throw new NonRetriableError("Board consent document not found");

      const submission = await docuseal.createSubmission({
        template_id: Number(template.docusealId),
        send_email: false,
        submitters: [
          {
            email: companyInvestor.email,
            role: "Signer",
            external_id: companyInvestor.userId.toString(),
          },
          {
            email: companyAdministrator.user.email,
            role: "Company Representative",
            external_id: companyAdministrator.userId.toString(),
          },
        ],
      });
      const [doc] = await db
        .insert(documents)
        .values({
          companyId: BigInt(companyId),
          type: DocumentType.EquityPlanContract,
          year,
          name: `Equity Incentive Plan ${year}`,
          equityGrantId: boardConsentDocument.equityGrantId,
          docusealSubmissionId: submission.id,
        })
        .returning();
      if (!doc) throw new NonRetriableError("Document not created");

      await db.insert(documentSignatures).values([
        {
          documentId: doc.id,
          userId: companyInvestor.userId,
          title: "Signer",
        },
        {
          documentId: doc.id,
          userId: companyAdministrator.userId,
          title: "Company Representative",
        },
      ]);

      return { message: "Equity plan contract created" };
    });

    await step.sendEvent("email.board-consent.member-signing-needed", {
      name: "email.board-consent.member-signing-needed",
      data: {
        boardConsentId: String(boardConsentId),
        documentId: String(documentId),
        companyId,
      },
    });

    return { message: "completed" };
  },
);
