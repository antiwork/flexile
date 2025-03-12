import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import {
  boardConsents,
  companies,
  companyAdministrators,
  companyInvestors,
  companyLawyers,
  documents,
  equityGrants,
} from "@/db/schema";
import env from "@/env";
import { inngest } from "@/inngest/client";
import AdminSigningEmail from "@/inngest/functions/emails/AdminSigningEmail";
import BoardSigningEmail from "@/inngest/functions/emails/BoardSigningEmail";
import { LawyerApprovalEmail } from "@/inngest/functions/emails/LawyerApprovalEmail";
import { sendEmails } from "@/trpc/email";
import { companyName } from "@/trpc/routes/companies";
import { assertDefined } from "@/utils/assert";

export const sendLawyerApprovalEmails = inngest.createFunction(
  { id: "send-lawyer-approval-emails" },
  { event: "email.board_consent.lawyer_approval_needed" },
  async ({ event, step }) => {
    const { boardConsentId, companyId } = event.data;

    const lawyerEmails = await step.run("fetch-lawyer-emails", async () => {
      const companyLawyersList = await db.query.companyLawyers.findMany({
        where: eq(companyLawyers.companyId, companyId),
        with: {
          user: true,
        },
      });

      if (companyLawyersList.length === 0) {
        throw new NonRetriableError(`Company ${companyId} has no lawyers`);
      }

      return companyLawyersList.map((lawyer) => ({ email: assertDefined(lawyer.user.email) }));
    });

    const data = await step.run("fetch-required-data", async () => {
      const consent = await db.query.boardConsents.findFirst({
        where: eq(boardConsents.id, boardConsentId),
        with: {
          equityAllocation: true,
        },
      });

      if (!consent) {
        throw new NonRetriableError(`Board consent not found: ${boardConsentId}`);
      }

      const [company, contractor, doc] = await Promise.all([
        assertDefined(
          await db.query.companies.findFirst({
            where: eq(companies.id, companyId),
            columns: {
              publicName: true,
              name: true,
            },
          }),
        ),
        assertDefined(
          await db.query.companyInvestors.findFirst({
            where: eq(companyInvestors.id, consent.companyInvestorId),
            with: {
              user: { columns: { legalName: true, email: true } },
            },
          }),
        ),
        assertDefined(
          await db.query.documents.findFirst({
            where: eq(documents.id, consent.documentId),
          }),
        ),
      ]);

      return {
        company: companyName(company),
        contractor,
        doc,
      };
    });

    const { company, contractor, doc } = data;
    const contractorName = contractor.user.legalName || contractor.user.email;

    await step.run("send-emails", async () => {
      const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/documents/${doc.id}`;

      return await sendEmails(
        {
          from: `${company} via Flexile <support@${env.DOMAIN}>`,
          subject: `Board consent requires your approval - ${company}`,
          react: LawyerApprovalEmail({
            contractorName,
            documentUrl,
            companyName: assertDefined(company),
          }),
        },
        lawyerEmails,
      );
    });

    return {
      sent: lawyerEmails.length,
      boardConsentId,
    };
  },
);

export const sendBoardSigningEmails = inngest.createFunction(
  { id: "send-board-signing-emails" },
  { event: "email.board_consent.member_signing_needed" },
  async ({ event, step }) => {
    const { boardConsentId, companyId } = event.data;

    const boardMemberEmails = await step.run("fetch-board-member-emails", async () => {
      const boardMembers = await db.query.companyAdministrators.findMany({
        where: and(eq(companyAdministrators.companyId, companyId), eq(companyAdministrators.boardMember, true)),
        with: {
          user: { columns: { email: true } },
        },
      });

      return boardMembers.map((admin) => ({ email: assertDefined(admin.user.email) }));
    });

    const data = await step.run("fetch-required-data", async () => {
      const consent = await db.query.boardConsents.findFirst({
        where: eq(boardConsents.id, boardConsentId),
      });

      if (!consent) {
        throw new NonRetriableError(`Board consent not found: ${boardConsentId}`);
      }

      const [company, contractor, doc] = await Promise.all([
        assertDefined(
          await db.query.companies.findFirst({
            where: eq(companies.id, companyId),
          }),
        ),
        assertDefined(
          await db.query.companyInvestors.findFirst({
            where: eq(companyInvestors.id, consent.companyInvestorId),
            with: {
              user: { columns: { legalName: true, email: true } },
            },
          }),
        ),
        assertDefined(
          await db.query.documents.findFirst({
            where: eq(documents.id, consent.documentId),
          }),
        ),
      ]);

      return { company: companyName(company), contractor, doc };
    });

    const { company, contractor, doc } = data;
    const contractorName = contractor.user.legalName || contractor.user.email;

    await step.run("send-emails", async () => {
      const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/documents/${doc.id}`;

      return await sendEmails(
        {
          from: `${company} via Flexile <support@${env.DOMAIN}>`,
          subject: "Board consent ready for signature",
          react: BoardSigningEmail({
            contractorName,
            documentUrl,
          }),
        },
        boardMemberEmails,
      );
    });

    return {
      sent: boardMemberEmails.length,
      boardConsentId,
    };
  },
);

export const sendAdminSigningEmail = inngest.createFunction(
  { id: "send-admin-signing-email" },
  { event: "email.equity_plan.admin_signing_needed" },
  async ({ event, step }) => {
    const { documentId, companyId, optionGrantId } = event.data;

    const companyAdminEmails = await step.run("fetch-company-admin-emails", async () => {
      const companyAdmins = await db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, companyId),
        with: {
          user: true,
        },
      });

      return companyAdmins.map((admin) => ({ email: assertDefined(admin.user.email) }));
    });

    const data = await step.run("fetch-required-data", async () => {
      const [document, grant, company] = await Promise.all([
        assertDefined(
          await db.query.documents.findFirst({
            where: eq(documents.id, documentId),
          }),
        ),
        assertDefined(
          await db.query.equityGrants.findFirst({
            where: eq(equityGrants.id, optionGrantId),
          }),
        ),
        assertDefined(
          await db.query.companies.findFirst({
            where: eq(companies.id, companyId),
          }),
        ),
      ]);

      return { document, grant, company: companyName(company) };
    });

    const { document, grant, company } = data;

    const user = await step.run("fetch-user", async () => {
      const companyInvestor = assertDefined(
        await db.query.companyInvestors.findFirst({
          where: eq(companyInvestors.id, grant.companyInvestorId),
          with: {
            user: { columns: { legalName: true, email: true } },
          },
        }),
        "Company investor not found",
      );

      return companyInvestor.user;
    });

    const userName = user.legalName || user.email;

    await step.run("send-emails", async () => {
      const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/documents/${document.id}`;

      return await sendEmails(
        {
          from: `${company} via Flexile <support@${env.DOMAIN}>`,
          subject: `Equity plan ready for signature`,
          react: AdminSigningEmail({
            userName,
            documentUrl,
          }),
        },
        companyAdminEmails,
      );
    });

    return {
      sent: companyAdminEmails.length,
      documentId,
    };
  },
);
