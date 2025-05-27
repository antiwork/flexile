import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { companies, companyAdministrators, companyInvestors, documents, equityGrants } from "@/db/schema";
import env from "@/env";
import AdminSigningEmail from "@/inngest/functions/emails/AdminSigningEmail";
import EquityGrantIssuedEmail from "@/inngest/functions/emails/EquityGrantIssuedEmail";
import { sendEmails } from "@/trpc/email";
import { companyName } from "@/trpc/routes/companies";
import { assertDefined } from "@/utils/assert";

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
