import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import {
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyUpdates,
  invoices,
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

      const eventData = event.data;
      const recipientTypes = eventData.recipientTypes || update.recipientTypes || ["investors", "active_contractors"];
      const minBilledAmount = eventData.minBilledAmount || 0;

      const baseQuery = (
        relationTable: typeof companyContractors | typeof companyInvestors | typeof companyAdministrators,
      ) =>
        db
          .selectDistinct({ email: users.email })
          .from(users)
          .leftJoin(relationTable, and(eq(users.id, relationTable.userId), eq(relationTable.companyId, company.id)));

      const queries = [];

      if (recipientTypes.includes("admins")) {
        const admins = baseQuery(companyAdministrators).where(isNotNull(companyAdministrators.id));
        queries.push(admins);
      }

      if (recipientTypes.includes("investors")) {
        const investors = baseQuery(companyInvestors).where(isNotNull(companyInvestors.id));
        queries.push(investors);
      }

      if (recipientTypes.includes("active_contractors")) {
        if (minBilledAmount > 0) {
          // Filter contractors by minimum billed amount
          const activeContractorsWithBilling = db
            .selectDistinct({ email: users.email })
            .from(users)
            .leftJoin(
              companyContractors,
              and(
                eq(users.id, companyContractors.userId),
                eq(companyContractors.companyId, company.id),
                isNull(companyContractors.endedAt),
              ),
            )
            .leftJoin(
              invoices,
              and(eq(invoices.companyContractorId, companyContractors.id), eq(invoices.status, "paid")),
            )
            .where(isNotNull(companyContractors.id))
            .groupBy(users.email)
            .having(sql`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0) >= ${minBilledAmount * 100}`);

          queries.push(activeContractorsWithBilling);
        } else {
          const activeContractors = baseQuery(companyContractors).where(
            and(isNotNull(companyContractors.id), isNull(companyContractors.endedAt)),
          );
          queries.push(activeContractors);
        }
      }

      if (recipientTypes.includes("alumni_contractors")) {
        if (minBilledAmount > 0) {
          // Filter contractors by minimum billed amount
          const alumniContractorsWithBilling = db
            .selectDistinct({ email: users.email })
            .from(users)
            .leftJoin(
              companyContractors,
              and(
                eq(users.id, companyContractors.userId),
                eq(companyContractors.companyId, company.id),
                isNotNull(companyContractors.endedAt),
              ),
            )
            .leftJoin(
              invoices,
              and(eq(invoices.companyContractorId, companyContractors.id), eq(invoices.status, "paid")),
            )
            .where(isNotNull(companyContractors.id))
            .groupBy(users.email)
            .having(sql`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0) >= ${minBilledAmount * 100}`);

          queries.push(alumniContractorsWithBilling);
        } else {
          const alumniContractors = baseQuery(companyContractors).where(
            and(isNotNull(companyContractors.id), isNotNull(companyContractors.endedAt)),
          );
          queries.push(alumniContractors);
        }
      }

      if (queries.length === 0) {
        return [];
      }

      // Combine all queries with UNION to de-duplicate recipients
      if (queries.length === 1) {
        return queries[0];
      }

      // Build union query manually for multiple queries
      let unionQuery = queries[0];
      for (let i = 1; i < queries.length; i++) {
        unionQuery = sql`${unionQuery} UNION ${queries[i]}`;
      }

      return db.select({ email: sql<string>`email` }).from(sql`(${unionQuery}) as combined_recipients`);
    });

    const logoUrl = await step.run("get-logo-url", async () => companyLogoUrl(company.id));

    const react = CompanyUpdatePublished({
      company,
      update,
      senderName: userDisplayName(sender),

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
