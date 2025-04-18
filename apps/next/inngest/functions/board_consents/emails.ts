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
import EquityGrantIssuedEmail from "@/inngest/functions/emails/EquityGrantIssuedEmail";
import { LawyerApprovalEmail } from "@/inngest/functions/emails/LawyerApprovalEmail";
import { sendEmails } from "@/trpc/email";
import { companyName } from "@/trpc/routes/companies";
import { assertDefined } from "@/utils/assert";

export const sendLawyerApprovalEmails = inngest.createFunction(
  { id: "send-lawyer-approval-emails" },
  { event: "email.board-consent.lawyer-approval-needed" },
  async ({ event, step }) => {
    const { boardConsentId, companyId } = event.data;

    const lawyerEmails = await step.run("fetch-lawyer-emails", async () => {
      const companyLawyersList = await db.query.companyLawyers.findMany({
        where: eq(companyLawyers.companyId, BigInt(companyId)),
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
        where: eq(boardConsents.id, BigInt(boardConsentId)),
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
            where: eq(companies.id, BigInt(companyId)),
            columns: {
              publicName: true,
              name: true,
            },
          }),
        ),
        assertDefined(
          await db.query.companyInvestors.findFirst({
            where: eq(companyInvestors.id, BigInt(consent.companyInvestorId)),
            with: {
              user: { columns: { legalName: true, email: true } },
            },
          }),
        ),
        assertDefined(
          await db.query.documents.findFirst({
            where: eq(documents.id, BigInt(consent.documentId)),
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
      const documentUrl = `${env.DOMAIN}/documents?sign=${doc.id}`;

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
  { event: "email.board-consent.member-signing-needed" },
  async ({ event, step }) => {
    const { boardConsentId, companyId } = event.data;

    const boardMemberEmails = await step.run("fetch-board-member-emails", async () => {
      const boardMembers = await db.query.companyAdministrators.findMany({
        where: and(eq(companyAdministrators.companyId, BigInt(companyId)), eq(companyAdministrators.boardMember, true)),
        with: {
          user: { columns: { email: true } },
        },
      });

      return boardMembers.map((admin) => ({ email: assertDefined(admin.user.email) }));
    });

    const data = await step.run("fetch-required-data", async () => {
      const consent = await db.query.boardConsents.findFirst({
        where: eq(boardConsents.id, BigInt(boardConsentId)),
      });

      if (!consent) {
        throw new NonRetriableError(`Board consent not found: ${boardConsentId}`);
      }

      const [company, contractor] = await Promise.all([
        assertDefined(
          await db.query.companies.findFirst({
            where: eq(companies.id, BigInt(companyId)),
          }),
        ),
        assertDefined(
          await db.query.companyInvestors.findFirst({
            where: eq(companyInvestors.id, BigInt(consent.companyInvestorId)),
            with: {
              user: { columns: { legalName: true, email: true } },
            },
          }),
        ),
      ]);

      return { company: companyName(company), contractor, consent };
    });

    const { company, contractor, consent } = data;
    const contractorName = contractor.user.legalName || contractor.user.email;

    await step.run("send-emails", async () => {
      const documentUrl = `${env.DOMAIN}/documents?sign=${consent.documentId}`;

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

export const sendEquityPlanSigningEmail = inngest.createFunction(
  { id: "send-equity-plan-signing-email" },
  { event: "email.equity-plan.signing-needed" },
  async ({ event, step }) => {
    const { documentId, companyId, optionGrantId } = event.data;

    const companyAdminEmails = await step.run("fetch-company-admin-emails", async () => {
      const companyAdmins = await db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, BigInt(companyId)),
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
            where: eq(documents.id, BigInt(documentId)),
          }),
        ),
        assertDefined(
          await db.query.equityGrants.findFirst({
            where: eq(equityGrants.id, BigInt(optionGrantId)),
            with: {
              vestingSchedule: true,
            },
          }),
        ),
        assertDefined(
          await db.query.companies.findFirst({
            where: eq(companies.id, BigInt(companyId)),
          }),
        ),
      ]);

      return { document, grant, company: companyName(company) };
    });

    const { document, grant, company } = data;

    const user = await step.run("fetch-user", async () => {
      const companyInvestor = assertDefined(
        await db.query.companyInvestors.findFirst({
          where: eq(companyInvestors.id, BigInt(grant.companyInvestorId)),
          with: {
            user: { columns: { legalName: true, email: true } },
          },
        }),
        "Company investor not found",
      );

      return companyInvestor.user;
    });

    const userName = user.legalName || user.email;
    const userEmail = assertDefined(user.email, "User email not found");

    await step.run("send-emails", async () => {
      const documentUrl = `${env.DOMAIN}/documents?sign=${document.id}`;
      const signGrantUrl = `${env.DOMAIN}/stock_options_contracts/${document.id}`;

      await Promise.all([
        sendEmails(
          {
            from: `${company} via Flexile <support@${env.DOMAIN}>`,
            subject: `Equity plan ready for signature`,
            react: AdminSigningEmail({
              userName,
              documentUrl,
            }),
          },
          companyAdminEmails,
        ),
        sendEmails(
          {
            from: `${company} via Flexile <support@${env.DOMAIN}>`,
            subject: `🔴 Action needed: sign your Incentive Plan to receive stock options`,
            react: EquityGrantIssuedEmail({
              companyName: assertDefined(company),
              grant,
              vestingSchedule: grant.vestingSchedule,
              signGrantUrl,
            }),
          },
          [{ email: userEmail }],
        ),
      ]);

      return { message: "Emails sent" };
    });

    return {
      sent: companyAdminEmails.length,
      documentId,
    };
  },
);
