import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { companies, companyContractors, companyInvestors, companyUpdates, users } from "@/db/schema";
import env from "@/env";
import { inngest } from "@/inngest/client";
import CompanyUpdatePublished from "@/inngest/functions/emails/CompanyUpdatePublished";
import { BATCH_SIZE, resend } from "@/trpc/email";
import { companyLogoUrl, companyName } from "@/trpc/routes/companies";
import { getFinancialReports } from "@/trpc/routes/companyUpdates";
import { userDisplayName } from "@/trpc/routes/users";

export default inngest.createFunction(
  { id: "send-company-update-emails" },
  { event: "company.update.published" },
  async ({ event, step }) => {
    const { updateId } = event.data;

    const update = await step.run("fetch-update", async () => {
      const result = await db.query.companyUpdates.findFirst({
        where: eq(companyUpdates.externalId, updateId),
      });

      if (!result) {
        throw new NonRetriableError(`Company update not found: ${updateId}`);
      }

      const company = await db.query.companies.findFirst({
        where: eq(companies.id, result.companyId),
        with: {
          administrators: {
            orderBy: (admins) => [admins.id],
            limit: 1,
            with: {
              user: true,
            },
          },
        },
      });

      if (!company) {
        throw new NonRetriableError(`Company not found: ${result.companyId}`);
      }

      const primaryAdmin = company.administrators[0]?.user;
      if (!primaryAdmin) {
        throw new NonRetriableError(`Company ${company.id} has no primary admin`);
      }

      return { ...result, company, sender: primaryAdmin };
    });
    const { company, sender } = update;

    const recipients = await step.run("fetch-recipients", async () => {
      if (event.data.recipients) return event.data.recipients;

      const baseQuery = (relationTable: typeof companyContractors | typeof companyInvestors) =>
        db
          .selectDistinct({ email: users.email })
          .from(users)
          .leftJoin(relationTable, and(eq(users.id, relationTable.userId), eq(relationTable.companyId, company.id)));

      const activeContractors = baseQuery(companyContractors).where(
        and(isNotNull(companyContractors.id), isNull(companyContractors.endedAt)),
      );
      const investors = baseQuery(companyInvestors).where(isNotNull(companyInvestors.id));

      return db
        .select({ email: sql<string>`email` })
        .from(sql`(${activeContractors} UNION ${investors}) as combined_recipients`);
    });

    const logoUrl = await step.run("get-logo-url", async () => companyLogoUrl(company.id));
    const financialReports = await step.run("get-financial-reports", async () => getFinancialReports(update));

    const react = CompanyUpdatePublished({
      company,
      update,
      senderName: userDisplayName(sender),
      financialReports,
      logoUrl,
    });
    const name = companyName(company);
    const sendEmailsSteps = Array.from({ length: Math.ceil(recipients.length / BATCH_SIZE) }, (_, batchIndex) => {
      const start = batchIndex * BATCH_SIZE;
      const recipientBatch = recipients.slice(start, start + BATCH_SIZE);

      return step.run(`send-update-emails-${batchIndex + 1}`, async () => {
        const emails = recipientBatch.map((recipient) => ({
          from: `${name} via Flexile <noreply@${env.DOMAIN}>`,
          to: recipient.email,
          subject: `${name}: ${update.title} investor update`,
          react,
        }));
        const response = await resend.batch.send(emails);
        if (response.error)
          throw new Error(`Resend error: ${response.error.message}; Recipients: ${emails.map((e) => e.to).join(", ")}`);
      });
    });

    await Promise.all(sendEmailsSteps);
  },
);
