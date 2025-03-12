import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { BoardConsentStatus, DocumentType } from "@/db/enums";
import { boardConsents, documents, equityAllocations, equityGrants } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { assertDefined } from "@/utils/assert";

export default inngest.createFunction(
  { id: "handle-board-approval" },
  { event: "board_consent.member_approved" },
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

      return assertDefined(consent, `Board consent ${boardConsentId} not found`);
    });

    // Ensure companyContractor.user exists
    const companyInvestorUser = assertDefined(boardConsent.companyInvestor.user);

    // Update equity allocation status
    await step.run("update-equity-allocation", async () => {
      await db
        .update(equityAllocations)
        .set({ status: "approved" })
        .where(eq(equityAllocations.id, boardConsent.equityAllocationId));
    });

    // Update board consent status
    await step.run("update-board-consent", async () => {
      await db
        .update(boardConsents)
        .set({
          status: BoardConsentStatus.BoardApproved,
          boardApprovedAt: new Date(),
        })
        .where(eq(boardConsents.id, BigInt(boardConsentId)));
    });

    const optionGrant = await step.run("fetch-equity-grant", async () =>
      assertDefined(
        await db.query.equityGrants.findFirst({
          where: eq(equityGrants.companyInvestorId, boardConsent.companyInvestorId),
          orderBy: desc(equityGrants.issuedAt),
        }),
      ),
    );

    // Generate equity plan document
    const equityPlanDocument = await step.run("generate-equity-plan", async () => {
      const [newDoc] = await db
        .insert(documents)
        .values({
          name: `Equity Plan - ${optionGrant.optionHolderName}`,
          companyId: boardConsent.companyId,
          userId: companyInvestorUser.id,
          type: DocumentType.EquityPlanContract,
          year: new Date().getFullYear(),
          equityGrantId: optionGrant.id,
          jsonData: {
            option_grant_id: optionGrant.id,
            optionholder_name: optionGrant.optionHolderName,
            option_type: optionGrant.optionGrantType,
            number_of_shares: optionGrant.numberOfShares,
            grant_date: optionGrant.issuedAt.toISOString().split("T")[0],
          },
        })
        .returning();

      return assertDefined(newDoc, "Failed to generate equity plan document");
    });

    // Send admin notification for equity plan signing
    await step.sendEvent("email.equity_plan.admin_signing_needed", {
      name: "email.equity_plan.admin_signing_needed",
      data: {
        documentId: equityPlanDocument.id,
        optionGrantId: optionGrant.id,
        companyId: boardConsent.companyId,
      },
    });

    // TODO: send email to investor that their equity grant was issued and their invoices are payable now

    return {
      optionGrantId: optionGrant.id,
      equityPlanDocumentId: equityPlanDocument.id,
    };
  },
);
