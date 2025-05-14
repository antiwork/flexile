import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { inngest } from "../client";

export default inngest.createFunction(
  { id: "quickbooks-integration-sync" },
  { event: "quickbooks/sync-integration" },
  async ({ event, step }) => {
    const { companyId } = event.data;

    const integration = await step.run("update-integration-status", async () => {
      const integration = await db.query.integrations.findFirst({
        where: (integrations, { and, eq }) =>
          and(
            eq(integrations.companyId, BigInt(companyId)),
            eq(integrations.type, "QuickbooksIntegration"),
            isNull(integrations.deletedAt),
          ),
      });
      if (integration) {
        await db.update(integrations).set({ status: "active" }).where(eq(integrations.id, integration.id));
      }
      return integration;
    });

    if (!integration) return { message: "integration not found or deleted" };

    await step.sendEvent("quickbooks/sync-financial-report", {
      name: "quickbooks/sync-financial-report",
      data: { companyId },
    });

    const activeWorkers = await step.run("fetch-workers", () =>
      db.query.companyContractors.findMany({
        columns: { id: true },
        where: (contractors, { and, eq }) =>
          and(eq(contractors.companyId, BigInt(companyId)), isNull(contractors.endedAt)),
      }),
    );

    if (activeWorkers.length > 0) {
      await step.sendEvent("quickbooks/sync-workers", {
        name: "quickbooks/sync-workers",
        data: {
          companyId,
          activeWorkerIds: activeWorkers.map(({ id }) => String(id)),
        },
      });
    }

    return { message: "completed" };
  },
);
