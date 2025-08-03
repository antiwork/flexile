import { faker } from "@faker-js/faker";
import { db } from "@test/db";
import type { QuickbooksIntegrationConfiguration } from "@/db/json";
import { integrations } from "@/db/schema";

export const integrationsFactory = {
  createQuickbooks: async (
    companyId: bigint,
    overrides: {
      status?: "initialized" | "active" | "out_of_sync" | "deleted";
      configuration?: Partial<QuickbooksIntegrationConfiguration>;
    } = {},
  ) => {
    const baseConfiguration: QuickbooksIntegrationConfiguration = {
      access_token: "test_access_token",
      refresh_token: "test_refresh_token",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      flexile_vendor_id: "123",
      flexile_clearance_bank_account_id: "456",
      consulting_services_expense_account_id: overrides.status === "active" ? "789" : null,
      flexile_fees_expense_account_id: overrides.status === "active" ? "790" : null,
      default_bank_account_id: overrides.status === "active" ? "791" : null,
      equity_compensation_expense_account_id: overrides.status === "active" ? "792" : null,
      ...overrides.configuration,
    };

    const [integration] = await db
      .insert(integrations)
      .values({
        companyId,
        type: "QuickbooksIntegration",
        status: overrides.status ?? "initialized",
        configuration: baseConfiguration,
        accountId: faker.string.numeric(10),
      })
      .returning();

    return { integration };
  },
};
