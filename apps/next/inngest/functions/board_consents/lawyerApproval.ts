import docuseal from "@docuseal/api";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { DocumentTemplateType, DocumentType } from "@/db/enums";
import { companyAdministrators, documents, documentTemplates } from "@/db/schema";
import { inngest } from "@/inngest/client";

export default inngest.createFunction(
  { id: "lawyer-board-consent-approval" },
  { event: "board_consent.lawyer_approved" },
  async ({ event, step }) => {
    const { boardConsentId, userId, companyId } = event.data;

    await step.run("generate-equity-plan-contract", async () => {
      const document = await db.query.documents.findFirst({
        where: and(
          eq(documents.userId, userId),
          eq(documents.companyId, companyId),
          eq(documents.type, DocumentType.EquityPlanContract),
        ),
      });

      if (!document) {
        const template = await db.query.documentTemplates.findFirst({
          where: and(
            eq(documentTemplates.type, DocumentTemplateType.EquityPlanContract),
            or(eq(documentTemplates.companyId, companyId), isNull(documentTemplates.companyId)),
          ),
          orderBy: desc(documentTemplates.createdAt),
        });
        if (!template) throw new Error("Equity plan contract template not found");

        const boardMembers = await db.query.companyAdministrators.findMany({
          where: eq(companyAdministrators.companyId, companyId),
          with: {
            user: {
              columns: {
                externalId: true,
                email: true,
              },
            },
          },
        });

        const submission = await docuseal.createSubmission({
          template_id: Number(template.docusealId),
          send_email: false,
          submitters: boardMembers.map((admin, index) => ({
            email: admin.user.email,
            role: `Board member ${index + 1}`,
            external_id: admin.user.externalId,
          })),
        });

        const year = new Date().getFullYear();
        await db.insert(documents).values({
          companyId,
          type: DocumentType.EquityPlanContract,
          userId,
          year,
          name: `Equity Incentive Plan ${year}`,
          docusealSubmissionId: submission.id,
        });
      }
    });

    await step.sendEvent("email.board_consent.member_signing_needed", {
      name: "email.board_consent.member_signing_needed",
      data: {
        boardConsentId,
        companyId,
      },
    });

    return { message: "completed" };
  },
);
