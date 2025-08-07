import { eq } from "drizzle-orm";
import QuickBooks, { type AppConfig, type StoreTokenData } from "quickbooks-node-promise";
import { db } from "@/db";
import type { QuickbooksIntegrationConfiguration } from "@/db/json";
import { integrations } from "@/db/schema";
import env from "@/env";
import { assert, assertDefined } from "@/utils/assert";

export const CLEARANCE_BANK_ACCOUNT_NAME = "Flexile.com Money Out Clearing";

const config: AppConfig = {
  appKey: env.QUICKBOOKS_CLIENT_ID,
  appSecret: env.QUICKBOOKS_CLIENT_SECRET,
  redirectUrl: `https://${env.DOMAIN}/oauth_redirect`,
  scope: ["com.intuit.quickbooks.accounting"],
  useProduction: process.env.NODE_ENV === "production",
  autoRefresh: true,
  minorversion: 75,
};

export const getQuickbooksAuthUrl = (state: string) => QuickBooks.authorizeUrl(config, state);

export const getQuickbooksTokenConfiguration = async (code: string, realmId: string) => {
  const qbo = new QuickBooks(config, realmId);
  return {
    tokenConfig: quickbooksTokenConfiguration(await qbo.createToken(code)),
    qbo,
  };
};

export const getQuickbooksClient = (integration: typeof integrations.$inferSelect) => {
  const configuration = integration.configuration;
  assert(!!configuration && "default_bank_account_id" in configuration);
  return new QuickBooks(
    {
      ...config,
      getToken() {
        return Promise.resolve({
          access_token: configuration.access_token,
          refresh_token: configuration.refresh_token,
          access_expire_timestamp: new Date(configuration.expires_at),
          refresh_expire_timestamp: new Date(configuration.refresh_token_expires_at),
        });
      },

      async saveToken(_, tokenData) {
        await db
          .update(integrations)
          .set({
            configuration: { ...configuration, ...quickbooksTokenConfiguration(tokenData) },
          })
          .where(eq(integrations.id, integration.id));

        return tokenData;
      },
    },
    integration.accountId,
  );
};

const quickbooksTokenConfiguration = (
  tokenData: StoreTokenData,
): Pick<
  QuickbooksIntegrationConfiguration,
  "access_token" | "refresh_token" | "expires_at" | "refresh_token_expires_at"
> => ({
  access_token: tokenData.access_token,
  refresh_token: assertDefined(tokenData.refresh_token),
  expires_at: new Date(tokenData.expires_in || 60 * 60 * 1000).toISOString(),
  refresh_token_expires_at: new Date(24 * 60 * 60 * 1000).toISOString(),
});
