import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import {
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyUpdates,
  users,
} from "@/db/schema";
import env from "@/env";
import { inngest } from "@/inngest/client";
import CompanyUpdatePublished from "@/inngest/functions/emails/CompanyUpdatePublished";
import { BATCH_SIZE, resend } from "@/trpc/email";
import { companyLogoUrl, companyName } from "@/trpc/routes/companies";
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

      // Ensure admins are always included
      let recipientTypes = update.recipientTypes || ["admins"];
      if (!recipientTypes.includes("admins")) {
        recipientTypes = ["admins", ...recipientTypes];
      }

      const baseQuery = (
        relationTable: typeof companyContractors | typeof companyInvestors | typeof companyAdministrators,
      ) =>
        db
          .selectDistinct({ email: users.email })
          .from(users)
          .leftJoin(relationTable, and(eq(users.id, relationTable.userId), eq(relationTable.companyId, company.id)));

      const queries = [];

      // Always include admins
      const admins = baseQuery(companyAdministrators).where(isNotNull(companyAdministrators.id));
      queries.push(admins);

      if (recipientTypes.includes("investors")) {
        const investors = baseQuery(companyInvestors).where(isNotNull(companyInvestors.id));
        queries.push(investors);
      }

      if (recipientTypes.includes("active_contractors")) {
        // TODO: once minBilledAmount is available on the update or in event.data,
        // filter active contractors by total billed amount ≥ minBilledAmount
        const activeContractors = baseQuery(companyContractors).where(
          and(isNotNull(companyContractors.id), isNull(companyContractors.endedAt)),
        );
        queries.push(activeContractors);
      }

      if (recipientTypes.includes("alumni_contractors")) {
        // TODO: once minBilledAmount is available on the update or in event.data,
        // filter alumni contractors by total billed amount ≥ minBilledAmount
        const alumniContractors = baseQuery(companyContractors).where(
          and(isNotNull(companyContractors.id), isNotNull(companyContractors.endedAt)),
        );
        queries.push(alumniContractors);
      }

      if (queries.length === 0) {
        return [];
      }

      // Combine all queries - for now just execute them separately and de-duplicate
      const allRecipients = [];
      for (const query of queries) {
        const results = await query;
        allRecipients.push(...results);
      }

      // De-duplicate by email
      const uniqueEmails = new Set(allRecipients.map((r) => r.email));
      return Array.from(uniqueEmails).map((email) => ({ email }));
    });

    const logoUrl = await step.run("get-logo-url", async () => companyLogoUrl(company.id));

    const react = CompanyUpdatePublished({
      company,
      update,
      senderName: userDisplayName(sender),

      logoUrl,
    });
    const name = companyName(company);
    const sendEmailsSteps = Array.from(
      { length: Math.ceil((recipients ?? []).length / BATCH_SIZE) },
      (_, batchIndex) => {
        const start = batchIndex * BATCH_SIZE;
        const recipientBatch = (recipients ?? []).slice(start, start + BATCH_SIZE);

        return step.run(`send-update-emails-${batchIndex + 1}`, async () => {
          const emails = recipientBatch.map((recipient) => ({
            from: `${name} via Flexile <noreply@${env.DOMAIN}>`,
            to: recipient.email,
            subject: `${name}: ${update.title}`,
            react,
          }));
          const response = await resend.batch.send(emails);
          if (response.error)
            throw new Error(
              `Resend error: ${response.error.message}; Recipients: ${emails.map((e) => e.to).join(", ")}`,
            );
        });
      },
    );

    await Promise.all(sendEmailsSteps);
  },
);
