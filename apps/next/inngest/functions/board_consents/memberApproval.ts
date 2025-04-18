import { and, desc, eq, isNull } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { BoardConsentStatus, DocumentType } from "@/db/enums";
import { boardConsents, documents, equityAllocations, equityGrants } from "@/db/schema";
import { inngest } from "@/inngest/client";

export default inngest.createFunction(
  { id: "handle-board-approval" },
  { event: "board-consent.member-approved" },
  async ({ event, step }) => {
    const { boardConsentId } = event.data;

    // Fetch board consent data
    const boardConsent = await step.run("fetch-board-consent", async () => {
      const consent = await db.query.boardConsents.findFirst({
        where: eq(boardConsents.id, BigInt(boardConsentId)),
        with: {
          companyInvestor: {
            with: {
              user: true,
            },
          },
        },
      });

      if (!consent) throw new NonRetriableError(`Board consent ${boardConsentId} not found`);

      return consent;
    });

    // Update equity allocation status
    await step.run("update-equity-allocation", async () => {
      await db
        .update(equityAllocations)
        .set({ status: "approved" })
        .where(eq(equityAllocations.id, boardConsent.equityAllocationId));
    });

    // Update board consent status
    await step.run("update-board-consent", async () => {
      const [updated] = await db
        .update(boardConsents)
        .set({
          status: BoardConsentStatus.BoardApproved,
          boardApprovedAt: new Date(),
        })
        .where(eq(boardConsents.id, BigInt(boardConsentId)))
        .returning();
      if (!updated) throw new NonRetriableError(`Board consent ${boardConsentId} not found`);

      return updated;
    });

    const result = await step.run("fetch-equity-grant", async () => {
      const grant = await db.query.equityGrants.findFirst({
        where: eq(equityGrants.companyInvestorId, boardConsent.companyInvestorId),
        with: {
          documents: {
            where: and(
              eq(documents.type, DocumentType.EquityPlanContract),
              eq(documents.year, new Date().getFullYear()),
              isNull(documents.deletedAt),
            ),
          },
        },
        orderBy: desc(equityGrants.issuedAt),
      });
      if (!grant) throw new NonRetriableError(`Equity grant for ${boardConsent.companyInvestorId} not found`);

      const equityPlanDocument = grant.documents[0];
      if (!equityPlanDocument) throw new NonRetriableError(`Equity plan document for ${grant.id} not found`);

      return {
        optionGrant: grant,
        equityPlanDocument,
      };
    });

    const { optionGrant, equityPlanDocument } = result;

    await step.sendEvent("email.equity-plan.admin-signing-needed", {
      name: "email.equity-plan.admin-signing-needed",
      data: {
        documentId: String(equityPlanDocument.id),
        optionGrantId: String(optionGrant.id),
        companyId: String(boardConsent.companyId),
      },
    });

    // TODO: send email to investor that their equity grant was issued and their invoices are payable now

    return {
      optionGrantId: String(optionGrant.id),
      equityPlanDocumentId: String(equityPlanDocument.id),
    };
  },
);
