import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { companies, companyAdministrators, companyContractors, companyInvestors, companyUpdates, invoices, users } from "@/db/schema";
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

      const filters = event.data.recipientFilters || {
        includeContractors: false,
        contractorStatus: "active",
        includeInvestors: true,
      };

      const queries: any[] = [];

      // Always include administrators
      const admins = db
        .selectDistinct({ email: users.email })
        .from(users)
        .innerJoin(companyAdministrators, and(
          eq(users.id, companyAdministrators.userId),
          eq(companyAdministrators.companyId, company.id)
        ));
      queries.push(admins);

      // Include contractors based on filters
      if (filters.includeContractors) {
        let contractorsQuery = db
          .selectDistinct({ email: users.email })
          .from(users)
          .innerJoin(companyContractors, and(
            eq(users.id, companyContractors.userId),
            eq(companyContractors.companyId, company.id)
          ));

        // Apply status filter
        if (filters.contractorStatus === "active") {
          contractorsQuery = contractorsQuery.where(isNull(companyContractors.endedAt));
        }

        // Apply billing threshold filter if specified
        if (filters.minBillingThreshold) {
          const contractorsWithBilling = db
            .select({
              email: users.email,
              totalBilled: sql<number>`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0)`,
            })
            .from(users)
            .innerJoin(companyContractors, and(
              eq(users.id, companyContractors.userId),
              eq(companyContractors.companyId, company.id)
            ))
            .leftJoin(invoices, eq(invoices.companyContractorId, companyContractors.id))
            .groupBy(users.email)
            .having(gte(sql`COALESCE(SUM(${invoices.totalAmountInUsdCents}), 0)`, filters.minBillingThreshold * 100));

          queries.push(contractorsWithBilling);
        } else {
          queries.push(contractorsQuery);
        }
      }

      // Include investors based on filters
      if (filters.includeInvestors) {
        let investorsQuery = db
          .selectDistinct({ email: users.email })
          .from(users)
          .innerJoin(companyInvestors, and(
            eq(users.id, companyInvestors.userId),
            eq(companyInvestors.companyId, company.id)
          ));

        // Apply investor type filter if specified
        if (filters.investorTypes && filters.investorTypes.length > 0) {
          investorsQuery = investorsQuery.where(
            sql`${companyInvestors.investorType} = ANY(${filters.investorTypes})`
          );
        }

        queries.push(investorsQuery);
      }

      // Combine all queries with UNION to de-duplicate
      if (queries.length === 1) {
        return queries[0];
      }

      const unionQuery = queries.reduce((acc, query, index) => {
        if (index === 0) return query;
        return sql`${acc} UNION ${query}`;
      });

      return db
        .select({ email: sql<string>`email` })
        .from(sql`(${unionQuery}) as combined_recipients`);
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
