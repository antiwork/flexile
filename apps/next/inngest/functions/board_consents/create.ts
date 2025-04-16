import docuseal from "@docuseal/api";
import { addMonths, formatISO } from "date-fns";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { BoardConsentStatus, DocumentTemplateType, DocumentType, PayRateType } from "@/db/enums";
import {
  boardConsents,
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyLawyers,
  documents,
  documentSignatures,
  documentTemplates,
  equityAllocations,
  equityGrants,
  optionPools,
} from "@/db/schema";
import { inngest } from "@/inngest/client";
import { assertDefined } from "@/utils/assert";

export default inngest.createFunction(
  { id: "board-consent-creation" },
  { event: "equity_allocation.lock" },
  async ({ event, step }) => {
    const { equityAllocationId, companyId, userId } = event.data;

    const data = await step.run("fetch-required-data", async () => {
      const [contractor, investor, optionPool] = await Promise.all([
        assertDefined(
          await db.query.companyContractors.findFirst({
            where: and(eq(companyContractors.userId, userId), eq(companyContractors.companyId, companyId)),
          }),
        ),
        assertDefined(
          await db.query.companyInvestors.findFirst({
            where: and(eq(companyInvestors.userId, userId), eq(companyInvestors.companyId, companyId)),
            with: {
              user: true,
            },
          }),
        ),
        assertDefined(
          await db.query.optionPools.findFirst({
            where: eq(optionPools.companyId, BigInt(companyId)),
          }),
        ),
      ]);

      return { contractor, investor, optionPool };
    });

    const { contractor, investor, optionPool } = data;

    const equityGrant = await step.run("create-default-equity-grant", async () => {
      const company = assertDefined(
        await db.query.companies.findFirst({
          where: eq(companies.id, BigInt(companyId)),
          columns: {
            sharePriceInUsd: true,
            fmvPerShareInUsd: true,
          },
        }),
      );

      // Calculate number of shares that would amount to $100,000
      const targetValueUsd = 100_000;
      const numberOfShares = Math.round(Number(targetValueUsd) / Number(company.fmvPerShareInUsd));

      // Get default values from option pool
      const vestingTrigger = contractor.payRateType === PayRateType.Salary ? "scheduled" : "invoice_paid";
      const currentDate = new Date();
      const legalName = assertDefined(investor.user.legalName);

      const [newEquityGrant] = await db
        .insert(equityGrants)
        .values({
          name: `Equity Grant for ${legalName}`,
          companyInvestorId: investor.id,
          optionPoolId: optionPool.id,
          numberOfShares,
          vestedShares: 0,
          exercisedShares: 0,
          forfeitedShares: 0,
          unvestedShares: numberOfShares,
          issuedAt: currentDate,
          periodStartedAt: currentDate,
          periodEndedAt: new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate()),
          issueDateRelationship: contractor.payRateType === PayRateType.Salary ? "employee" : "consultant",
          optionHolderName: legalName,
          optionGrantType: contractor.payRateType === PayRateType.Salary ? "iso" : "nso",
          expiresAt: addMonths(currentDate, optionPool.defaultOptionExpiryMonths),
          boardApprovalDate: formatISO(currentDate, { representation: "date" }),
          sharePriceUsd: assertDefined(company.sharePriceInUsd),
          exercisePriceUsd: assertDefined(company.fmvPerShareInUsd),
          vestingTrigger,
          vestingScheduleId: null,
          voluntaryTerminationExerciseMonths: optionPool.voluntaryTerminationExerciseMonths,
          involuntaryTerminationExerciseMonths: optionPool.involuntaryTerminationExerciseMonths,
          terminationWithCauseExerciseMonths: optionPool.terminationWithCauseExerciseMonths,
          deathExerciseMonths: optionPool.deathExerciseMonths,
          disabilityExerciseMonths: optionPool.disabilityExerciseMonths,
          retirementExerciseMonths: optionPool.retirementExerciseMonths,
        })
        .returning();

      return assertDefined(newEquityGrant, "Failed to create default equity grant");
    });

    // Update company investor with total options
    await step.run("update-company-investor", async () => {
      await db
        .update(companyInvestors)
        .set({
          totalOptions: BigInt(Number(equityGrant.numberOfShares) + Number(investor.totalOptions)),
        })
        .where(eq(companyInvestors.id, investor.id));
    });

    const boardMembers = await step.run("fetch-board-members", async () => {
      const boardMembers = await db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, BigInt(companyId)),
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
      // Fetch the most recent board consent document template
      const template = await db.query.documentTemplates.findFirst({
        where: and(
          eq(documentTemplates.type, DocumentTemplateType.BoardConsent),
          or(eq(documentTemplates.companyId, BigInt(companyId)), isNull(documentTemplates.companyId)),
        ),
        orderBy: desc(documentTemplates.createdAt),
      });

      if (!template) throw new Error("Board consent document template not found");

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
          companyId: BigInt(companyId),
          type: DocumentType.BoardConsent,
          year: new Date().getFullYear(),
          equityGrantId: equityGrant.id,
          docusealSubmissionId: submission.id,
        })
        .returning();

      await db.insert(documentSignatures).values(
        boardMembers.map((member) => ({
          documentId: assertDefined(doc).id,
          userId: member.user.id,
          title: `Board member ${member.user.preferredName}`,
        })),
      );

      return assertDefined(doc, "Failed to create document");
    });

    // Create board consent
    const boardConsent = await step.run("create-board-consent", async () => {
      const [newConsent] = await db
        .insert(boardConsents)
        .values({
          equityAllocationId: BigInt(equityAllocationId),
          companyId: investor.companyId,
          companyInvestorId: investor.id,
          documentId: document.id,
          status: BoardConsentStatus.Pending,
        })
        .returning();

      return assertDefined(newConsent, "Failed to create board consent");
    });

    // Update equity allocation status
    await step.run("update-equity-allocation", async () => {
      await db
        .update(equityAllocations)
        .set({ status: "pending_approval", locked: true })
        .where(eq(equityAllocations.id, BigInt(equityAllocationId)));
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
      await step.sendEvent("email.board_consent.lawyer_approval_needed", {
        name: "email.board_consent.lawyer_approval_needed",
        data: {
          boardConsentId: boardConsent.id,
          companyId: investor.companyId,
          companyInvestorId: investor.id,
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
          companyId: investor.companyId,
          companyInvestorId: investor.id,
        },
      });
    }

    return { boardConsentId: boardConsent.id };
  },
);
