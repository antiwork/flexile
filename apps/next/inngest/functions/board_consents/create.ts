import docuseal from "@docuseal/api";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { BoardConsentStatus, DocumentTemplateType, DocumentType } from "@/db/enums";
import {
  boardConsents,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyLawyers,
  documents,
  documentSignatures,
  documentTemplates,
  equityAllocations,
} from "@/db/schema";
import { inngest } from "@/inngest/client";

export default inngest.createFunction(
  { id: "board-consent-creation" },
  { event: "board_consent.created" },
  async ({ event, step }) => {
    const { equityGrantId, companyId, companyWorkerId } = event.data;

    const data = await step.run("fetch-required-data", async () => {
      const companyContractor = await db.query.companyContractors.findFirst({
        where: eq(companyContractors.id, companyWorkerId),
        with: {
          user: true,
          equityAllocations: {
            where: eq(equityAllocations.year, new Date().getFullYear()),
          },
        },
      });

      if (!companyContractor) return null;

      return { companyContractor };
    });

    if (!data) return { message: "Company contractor not found" };

    const { companyContractor } = data;

    const equityAllocation = companyContractor.equityAllocations[0];
    if (equityAllocation?.status !== "pending_grant_creation") {
      return { message: "Equity allocation is not pending grant creation" };
    }

    const boardMembers = await step.run("fetch-board-members", async () => {
      const boardMembers = await db.query.companyAdministrators.findMany({
        where: and(eq(companyAdministrators.companyId, companyId), eq(companyAdministrators.boardMember, true)),
        with: {
          user: {
            columns: {
              id: true,
              externalId: true,
              email: true,
              legalName: true,
              preferredName: true,
            },
          },
        },
      });

      return boardMembers;
    });

    const document = await step.run("generate-document", async () => {
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.type, DocumentTemplateType.BoardConsent),
          or(eq(documentTemplates.companyId, companyId), isNull(documentTemplates.companyId)),
        ),
        orderBy: desc(documentTemplates.createdAt),
      });

      if (!template) return null;

      const submission = await docuseal.createSubmission({
        template_id: Number(template.docusealId),
        send_email: false,
        submitters: boardMembers.map((member, index) => ({
          email: member.user.email,
          role: `Board member ${index + 1}`,
          external_id: member.user.externalId,
        })),
      });

      const [doc] = await db
        .insert(documents)
        .values({
          name: "Board Consent Document",
          companyId,
          type: DocumentType.BoardConsent,
          year: new Date().getFullYear(),
          equityGrantId,
          docusealSubmissionId: submission.id,
        })
        .returning();

      if (!doc) return null;

      await db.insert(documentSignatures).values(
        boardMembers.map((member) => ({
          documentId: doc.id,
          userId: member.user.id,
          title: `Board member ${member.user.preferredName}`,
        })),
      );

      return doc;
    });

    if (!document) return { message: "Failed to create document" };

    // Create board consent
    const boardConsent = await step.run("create-board-consent", async () => {
      const companyInvestor = await db.query.companyInvestors.findFirst({
        where: and(eq(companyInvestors.companyId, companyId), eq(companyInvestors.userId, companyContractor.userId)),
        columns: {
          id: true,
        },
      });

      if (!companyInvestor) return null;

      const [newConsent] = await db
        .insert(boardConsents)
        .values({
          equityAllocationId: equityAllocation.id,
          companyId: companyContractor.companyId,
          companyInvestorId: companyInvestor.id,
          documentId: document.id,
          status: BoardConsentStatus.Pending,
        })
        .returning();

      return newConsent;
    });

    if (!boardConsent) return { message: "Failed to create board consent" };

    // Update equity allocation status
    await step.run("update-equity-allocation", async () => {
      await db
        .update(equityAllocations)
        .set({ status: "pending_approval" })
        .where(eq(equityAllocations.id, equityAllocation.id));
    });

    // Check if company has lawyers
    const hasLawyers = await step.run("check-for-lawyers", async () => {
      const lawyers = await db.query.companyLawyers.findMany({
        where: eq(companyLawyers.companyId, companyContractor.companyId),
      });

      return lawyers.length > 0;
    });

    if (hasLawyers) {
      // Send notification to company lawyers
      await step.sendEvent("email.board_consent.lawyer_approval_needed", {
        name: "email.board_consent.lawyer_approval_needed",
        data: {
          boardConsentId: boardConsent.id,
          companyId: companyContractor.companyId,
          companyInvestorId: companyContractor.id,
        },
      });
    } else {
      // Skip lawyer approval, auto-approve and notify board members
      await step.run("board_consent.auto_approve", async () => {
        await db
          .update(boardConsents)
          .set({
            status: BoardConsentStatus.LawyerApproved,
            lawyerApprovedAt: new Date(),
          })
          .where(eq(boardConsents.id, boardConsent.id));
      });

      await step.sendEvent("email.board_consent.member_signing_needed", {
        name: "email.board_consent.member_signing_needed",
        data: {
          boardConsentId: boardConsent.id,
          companyId: companyContractor.companyId,
          companyInvestorId: companyContractor.id,
        },
      });
    }

    return { boardConsentId: boardConsent.id };
  },
);
