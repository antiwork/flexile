import { endOfMonth, formatISO, startOfMonth, subMonths } from "date-fns";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyMonthlyFinancialReports, integrations } from "@/db/schema";
import { getQuickbooksClient } from "@/lib/quickbooks";
import { inngest } from "../client";

const reportSchema = z.object({
  Rows: z.object({
    Row: z.array(
      z.object({
        Summary: z.object({
          ColData: z.array(
            z.object({
              value: z.string().optional(),
            }),
          ),
        }),
      }),
    ),
  }),
});

export default inngest.createFunction(
  { id: "quickbooks-financial-report-sync" },
  { event: "quickbooks/sync-financial-report" },
  async ({ event, step }) => {
    const { companyId } = event.data;

    const lastMonth = await step.run("get-last-month", () => subMonths(new Date(), 1));

    const result = await step.run("fetch-report", async () => {
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, BigInt(companyId)),
        with: {
          integrations: {
            where: and(eq(integrations.type, "QuickbooksIntegration"), eq(integrations.status, "active")),
          },
        },
      });

      const integration = company?.integrations[0];
      if (!integration) return null;

      const qbo = getQuickbooksClient(integration);
      const report = reportSchema.parse(
        await qbo.reportProfitAndLoss({
          start_date: formatISO(startOfMonth(lastMonth), { representation: "date" }),
          end_date: formatISO(endOfMonth(lastMonth), { representation: "date" }),
        }),
      );

      let totalIncome = 0;
      let netIncome = 0;

      for (const row of report.Rows.Row) {
        const label = row.Summary.ColData[0]?.value;
        const value = parseFloat(row.Summary.ColData[1]?.value || "0");
        if (label === "Total Income") totalIncome = value;
        if (label === "Net Income") netIncome = value;
      }

      return {
        revenue: totalIncome,
        netIncome,
      };
    });

    if (!result) return { message: "no active integration, skipped" };

    await step.run("save-report", () =>
      db
        .insert(companyMonthlyFinancialReports)
        .values({
          companyId: BigInt(companyId),
          year: lastMonth.getFullYear(),
          month: lastMonth.getMonth() + 1, // We use 1-12 for months in the database
          revenueCents: BigInt(Math.round(result.revenue * 100)),
          netIncomeCents: BigInt(Math.round(result.netIncome * 100)),
        })
        .onConflictDoUpdate({
          target: [
            companyMonthlyFinancialReports.companyId,
            companyMonthlyFinancialReports.year,
            companyMonthlyFinancialReports.month,
          ],
          set: {
            revenueCents: BigInt(Math.round(result.revenue * 100)),
            netIncomeCents: BigInt(Math.round(result.netIncome * 100)),
          },
        }),
    );

    return { message: "completed" };
  },
);
