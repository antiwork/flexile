import { and, eq, isNull } from "drizzle-orm";
import { Quickbooks } from "quickbooks-node-promise";
import { db } from "@/db";
import { companyContractors, integrationRecords, integrations } from "@/db/schema";
import { getQuickbooksClient } from "@/lib/quickbooks";
import { latestUserComplianceInfo } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import { inngest } from "../client";

export default inngest.createFunction(
  { id: "quickbooks-vendors-sync" },
  { event: "quickbooks/sync-workers" },
  async ({ event, step }) => {
    const { companyId, activeWorkerIds } = event.data;

    const integration = await step.run("fetch-integration", () =>
      db.query.integrations.findFirst({
        where: and(
          eq(integrations.companyId, BigInt(companyId)),
          eq(integrations.type, "QuickbooksIntegration"),
          eq(integrations.status, "active"),
        ),
      }),
    );

    if (!integration) return { message: "integration not available" };

    const qbo = getQuickbooksClient(integration);

    const allVendors = await step.run("fetch-vendors", () => fetchAllVendors(qbo));

    await Promise.all(
      activeWorkerIds.map((workerId) =>
        step.run(`sync-worker-${workerId}`, async () => {
          const worker = await db.query.companyContractors.findFirst({
            where: eq(companyContractors.id, BigInt(workerId)),
            with: {
              user: { with: { userComplianceInfos: latestUserComplianceInfo } },
            },
          });

          if (!worker) return { message: "worker not found" };

          const complianceInfo = worker.user.userComplianceInfos[0];
          const displayName =
            (complianceInfo?.businessEntity ? complianceInfo.businessName : complianceInfo?.legalName) ?? "";

          const existingVendor = allVendors.find(
            (vendor) => vendor.PrimaryEmailAddr?.Address === worker.user.email && vendor.DisplayName === displayName,
          );

          if (existingVendor?.Id) {
            await upsertWorker({
              integrationId: integration.id,
              integratableType: "CompanyContractor",
              integratableId: worker.id,
              integrationExternalId: existingVendor.Id,
              syncToken: existingVendor.SyncToken ?? null,
            });
            return { message: `updated sync token for existing vendor: ${existingVendor.Id}` };
          }

          const billingAddress =
            worker.user.streetAddress &&
            worker.user.city &&
            worker.user.state &&
            worker.user.zipCode &&
            worker.user.countryCode
              ? {
                  BillAddr: {
                    Line1: worker.user.streetAddress,
                    City: worker.user.city,
                    CountrySubDivisionCode: worker.user.state,
                    PostalCode: worker.user.zipCode,
                    Country: worker.user.countryCode,
                  },
                }
              : {};

          const newVendor = await qbo.createVendor({
            DisplayName: displayName,
            GivenName: worker.user.legalName ?? "",
            PrimaryEmailAddr: {
              Address: worker.user.email,
            },
            ...billingAddress,
            ...(worker.payRateInSubunits && { BillRate: worker.payRateInSubunits / 100 }),
            Vendor1099: false,
            Active: true,
          });

          const { message } = await upsertWorker({
            integrationId: integration.id,
            integratableType: "CompanyContractor",
            integratableId: worker.id,
            integrationExternalId: assertDefined(newVendor.Vendor.Id),
            syncToken: newVendor.Vendor.SyncToken ?? null,
          });

          return { message: `created new vendor: ${newVendor.Vendor.Id}. ${message}` };
        }),
      ),
    );

    await step.run("update-integration", () =>
      db.update(integrations).set({ lastSyncAt: new Date() }).where(eq(integrations.id, integration.id)),
    );

    return { message: "completed" };
  },
);

const upsertWorker = async (
  data: Omit<typeof integrationRecords.$inferInsert, "integratableType" | "integratableId"> & {
    integratableType: NonNullable<(typeof integrationRecords.$inferInsert)["integratableType"]>;
    integratableId: NonNullable<(typeof integrationRecords.$inferInsert)["integratableId"]>;
  },
) => {
  const existing = await db.query.integrationRecords.findFirst({
    where: and(
      eq(integrationRecords.integrationId, data.integrationId),
      eq(integrationRecords.integratableType, data.integratableType),
      eq(integrationRecords.integratableId, data.integratableId),
      isNull(integrationRecords.deletedAt),
    ),
  });

  if (existing) {
    await db.update(integrationRecords).set(data).where(eq(integrationRecords.id, existing.id));
    return { message: `updated integrationRecord ${existing.id}` };
  }
  await db.insert(integrationRecords).values(data);
  return { message: `inserted integrationRecord for ${data.integratableType}:${data.integratableId}` };
};

type Vendor = NonNullable<
  NonNullable<Awaited<ReturnType<typeof Quickbooks.prototype.findVendors>>["QueryResponse"]["Vendor"]>[number]
>;

async function fetchAllVendors(qbo: Quickbooks) {
  const allVendors: Vendor[] = [];
  let startPosition = 1;

  while (true) {
    const response = await qbo.findVendors(`SELECT * FROM Vendor WHERE Active = true STARTPOSITION ${startPosition}`);

    const vendors = response.QueryResponse.Vendor ?? [];
    allVendors.push(...vendors);

    if (vendors.length === 0) break;

    startPosition += vendors.length;
  }

  return allVendors;
}
