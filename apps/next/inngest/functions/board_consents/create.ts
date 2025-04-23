import docuseal from "@docuseal/api";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { NonRetriableError } from "inngest";
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
  { event: "board-consent.create" },
  async ({ event, step }) => {
    const { equityGrantId, companyId, companyWorkerId } = event.data;

    const result = await step.run("fetch-required-data", async () => {
      const companyContractor = await db.query.companyContractors.findFirst({
        where: eq(companyContractors.id, BigInt(companyWorkerId)),
        with: {
          user: true,
          equityAllocations: {
            columns: {
              id: true,
              status: true,
            },
            where: eq(equityAllocations.year, new Date().getFullYear()),
          },
        },
      });

      if (!companyContractor) {
        throw new NonRetriableError(`Company contractor not found: ${companyWorkerId}`);
      }

      const equityAllocation = companyContractor.equityAllocations[0];

      if (!equityAllocation) {
        throw new NonRetriableError(`Equity allocation not found for company contractor: ${companyWorkerId}`);
      }

      if (equityAllocation.status !== "pending_grant_creation") {
        throw new NonRetriableError(`Equity allocation is not pending grant creation: ${equityAllocation.id}`);
      }

      const companyInvestor = await db.query.companyInvestors.findFirst({
        where: and(
          eq(companyInvestors.companyId, companyContractor.companyId),
          eq(companyInvestors.userId, companyContractor.userId),
        ),
      });

      if (!companyInvestor) {
        throw new NonRetriableError(`Company investor not found: ${companyId}`);
      }

      return { equityAllocation, companyInvestor };
    });

    const { equityAllocation, companyInvestor } = result;

    const boardMembers = await step.run("fetch-board-members", async () => {
      const boardMembers = await db.query.companyAdministrators.findMany({
        where: and(eq(companyAdministrators.companyId, BigInt(companyId)), eq(companyAdministrators.boardMember, true)),
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
          or(eq(documentTemplates.companyId, BigInt(companyId)), isNull(documentTemplates.companyId)),
        ),
        orderBy: desc(documentTemplates.createdAt),
      });

      if (!template) {
        throw new NonRetriableError(`Board consent document template not found: ${companyId}`);
      }

      const submission = await docuseal.createSubmission({
        template_id: Number(template.docusealId),
        send_email: false,
        submitters: boardMembers.map((member, index) => ({
          email: member.user.email,
          role: index === 0 ? `Board member` : `Board member ${index + 1}`,
          external_id: member.user.externalId,
        })),
      });

      const [doc] = await db
        .insert(documents)
        .values({
          name: "Board Consent Document",
          companyId: BigInt(companyId),
          type: DocumentType.BoardConsent,
          year: new Date().getFullYear(),
          equityGrantId: BigInt(equityGrantId),
          docusealSubmissionId: submission.id,
        })
        .returning();

      if (!doc) throw new NonRetriableError(`Failed to create document: ${companyId}`);

      await db.insert(documentSignatures).values(
        boardMembers.map((member, index) => ({
          documentId: doc.id,
          userId: member.user.id,
          title: index === 0 ? `Board member` : `Board member ${index + 1}`,
        })),
      );

      return doc;
    });

    // Create board consent
    const boardConsent = await step.run("create-board-consent", async () => {
      const [newConsent] = await db
        .insert(boardConsents)
        .values({
          equityAllocationId: equityAllocation.id,
          companyId: BigInt(companyId),
          companyInvestorId: companyInvestor.id,
          documentId: document.id,
          status: BoardConsentStatus.Pending,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newConsent;
    });

    if (!boardConsent) throw new NonRetriableError(`Failed to create board consent: ${companyId}`);

    // Update equity allocation status
    await step.run("update-equity-allocation", async () => {
      const [updated] = await db
        .update(equityAllocations)
        .set({ status: "pending_approval" })
        .where(eq(equityAllocations.id, equityAllocation.id))
        .returning();

      if (!updated) throw new NonRetriableError(`Failed to update equity allocation: ${equityAllocation.id}`);

      return updated;
    });

    // Check if company has lawyers
    const hasLawyers = await step.run("check-for-lawyers", async () => {
      const lawyers = await db.query.companyLawyers.findMany({
        where: eq(companyLawyers.companyId, BigInt(companyId)),
      });

      return lawyers.length > 0;
    });

    if (hasLawyers) {
      // Send notification to company lawyers
      await step.sendEvent("email.board-consent.lawyer-approval-needed", {
        name: "email.board-consent.lawyer-approval-needed",
        data: {
          boardConsentId: String(boardConsent.id),
          companyId,
          companyInvestorId: String(companyInvestor.id),
        },
      });
    } else {
      // Skip lawyer approval, auto-approve and notify board members
      await step.run("board-consent.auto-approve", async () => {
        const [updated] = await db
          .update(boardConsents)
          .set({
            status: BoardConsentStatus.LawyerApproved,
            lawyerApprovedAt: new Date(),
          })
          .where(eq(boardConsents.id, boardConsent.id))
          .returning();

        if (!updated) throw new NonRetriableError(`Failed to update board consent: ${boardConsent.id}`);

        return updated;
      });

      await step.sendEvent("email.board-consent.member-signing-needed", {
        name: "email.board-consent.member-signing-needed",
        data: {
          boardConsentId: String(boardConsent.id),
          companyId,
        },
      });
    }

    return { boardConsentId: boardConsent.id };
  },
);
