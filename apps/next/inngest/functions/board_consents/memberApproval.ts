import { formatISO } from "date-fns";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { DocumentType } from "@/db/enums";
import { boardConsents, documents, equityAllocations, equityGrants } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { assertDefined } from "@/utils/assert";

export default inngest.createFunction(
  { id: "handle-board-approval" },
  { event: "board-consent.member-approved" },
  async ({ event, step }) => {
    const { boardConsentId } = event.data;

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

    await step.run("update-equity-allocation", async () => {
      await db
        .update(equityAllocations)
        .set({ status: "approved" })
        .where(eq(equityAllocations.id, boardConsent.equityAllocationId));

      return { message: "Equity allocation approved" };
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

      // Update the board approval date
      const [updatedGrant] = await db
        .update(equityGrants)
        .set({ boardApprovalDate: formatISO(assertDefined(boardConsent.boardApprovedAt), { representation: "date" }) })
        .where(eq(equityGrants.id, grant.id))
        .returning();

      if (!updatedGrant) throw new NonRetriableError(`Equity grant ${grant.id} not updated`);
      return {
        optionGrant: updatedGrant,
        equityPlanDocument,
      };
    });

    const { optionGrant, equityPlanDocument } = result;

    await step.sendEvent("email.equity-plan.signing-needed", {
      name: "email.equity-plan.signing-needed",
      data: {
        documentId: String(equityPlanDocument.id),
        optionGrantId: String(optionGrant.id),
        companyId: String(boardConsent.companyId),
      },
    });

    return {
      optionGrantId: String(optionGrant.id),
      equityPlanDocumentId: String(equityPlanDocument.id),
    };
  },
);
