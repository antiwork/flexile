import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { inngest } from "@/inngest/client";
import {
  CLEARANCE_BANK_ACCOUNT_NAME,
  getQuickbooksAuthUrl,
  getQuickbooksClient,
  getQuickbooksTokenConfiguration,
} from "@/lib/quickbooks";
import { type CompanyContext, companyProcedure, createRouter } from "@/trpc";
import { assert, assertDefined } from "@/utils/assert";

const oauthState = (ctx: CompanyContext) => Buffer.from(`${ctx.company.id}:${ctx.company.name}`).toString("base64");

const companyIntegration = async (companyId: bigint) => {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.companyId, companyId),
      eq(integrations.type, "QuickbooksIntegration"),
      isNull(integrations.deletedAt),
    ),
  });
  if (!integration) return null;
  assert(!!integration.configuration && "default_bank_account_id" in integration.configuration);
  return { ...integration, configuration: integration.configuration };
};

export const quickbooksRouter = createRouter({
  get: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyIntegration(ctx.company.id);
    if (!integration) return null;
    const data = {
      status: integration.status,
      consultingServicesExpenseAccountId: integration.configuration.consulting_services_expense_account_id,
      flexileFeesExpenseAccountId: integration.configuration.flexile_fees_expense_account_id,
      equityCompensationExpenseAccountId: integration.configuration.equity_compensation_expense_account_id,
      defaultBankAccountId: integration.configuration.default_bank_account_id,
      expenseAccounts: [],
      bankAccounts: [],
    };
    if (integration.status !== "active") return data;

    const qbo = getQuickbooksClient(integration);
    const [expenseAccounts, bankAccounts] = await Promise.all([
      qbo.findAccounts({ AccountType: "Expense" }),
      qbo.findAccounts({ AccountType: "Bank" }),
    ]);
    const formatAccounts = (accounts: typeof expenseAccounts.QueryResponse.Account) =>
      accounts?.map((account) => ({
        id: assertDefined(account.Id),
        name: account.AcctNum ? `${account.AcctNum} - ${account.Name}` : account.Name,
      }));

    return {
      ...data,
      expenseAccounts: formatAccounts(expenseAccounts.QueryResponse.Account),
      bankAccounts: formatAccounts(
        bankAccounts.QueryResponse.Account?.filter((account) => account.Name !== CLEARANCE_BANK_ACCOUNT_NAME),
      ),
    };
  }),

  // TODO (try to) move this to the page itself once in Clerk
  getAuthUrl: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return getQuickbooksAuthUrl(oauthState(ctx));
  }),

  connect: companyProcedure
    .input(z.object({ code: z.string(), state: z.string(), realmId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      if (input.state !== oauthState(ctx)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OAuth state" });

      const integration = await companyIntegration(ctx.company.id);

      const { tokenConfig, qbo } = await getQuickbooksTokenConfiguration(input.code, input.realmId);

      if (integration) {
        await db
          .update(integrations)
          .set({
            status: integration.status === "out_of_sync" ? "active" : integration.status,
            configuration: {
              ...integration.configuration,
              ...tokenConfig,
            },
          })
          .where(eq(integrations.id, integration.id));
      } else {
        const existingAccount = await qbo.findAccounts({
          AccountType: "Bank",
          Name: CLEARANCE_BANK_ACCOUNT_NAME,
          Active: true,
        });
        let clearanceBankAccountId = existingAccount.QueryResponse.Account?.[0]?.Id;
        if (!clearanceBankAccountId) {
          const newAccount = await qbo.createAccount({
            Name: CLEARANCE_BANK_ACCOUNT_NAME,
            AccountType: "Bank",
            AccountSubType: "Checking",
          });
          clearanceBankAccountId = assertDefined(newAccount.Account.Id);
        }

        const existingVendor = await qbo.findVendors({ DisplayName: "Flexile" });
        let vendorId = existingVendor.QueryResponse.Vendor?.[0]?.Id;
        if (!vendorId) {
          const newVendor = await qbo.createVendor({
            DisplayName: "Flexile",
            PrimaryEmailAddr: {
              Address: "hi@flexile.com",
            },
            WebAddr: {
              URI: "https://flexile.com",
            },
            CompanyName: "Gumroad Inc.",
            TaxIdentifier: "453361423",
            BillAddr: {
              City: "San Francisco",
              Line1: "548 Market St",
              PostalCode: "94104-5401",
              Country: "US",
              CountrySubDivisionCode: "CA",
            },
          });
          vendorId = assertDefined(newVendor.Vendor.Id);
        }

        await db.insert(integrations).values({
          type: "QuickbooksIntegration",
          accountId: input.realmId,
          companyId: ctx.company.id,
          status: "initialized",
          configuration: {
            ...tokenConfig,
            flexile_vendor_id: vendorId,
            flexile_clearance_bank_account_id: clearanceBankAccountId,
            consulting_services_expense_account_id: null,
            flexile_fees_expense_account_id: null,
            default_bank_account_id: null,
            equity_compensation_expense_account_id: null,
          },
        });
      }
    }),

  disconnect: companyProcedure.mutation(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const integration = await companyIntegration(ctx.company.id);
    if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

    const qbo = getQuickbooksClient(integration);
    await qbo.revokeAccess();

    await db
      .update(integrations)
      .set({ deletedAt: new Date(), status: "deleted" })
      .where(eq(integrations.id, integration.id));
  }),

  updateConfiguration: companyProcedure
    .input(
      z.object({
        consultingServicesExpenseAccountId: z.string(),
        flexileFeesExpenseAccountId: z.string(),
        equityCompensationExpenseAccountId: z.string().optional(),
        defaultBankAccountId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const integration = await companyIntegration(ctx.company.id);
      if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(integrations)
        .set({
          configuration: {
            ...integration.configuration,
            consulting_services_expense_account_id: input.consultingServicesExpenseAccountId,
            flexile_fees_expense_account_id: input.flexileFeesExpenseAccountId,
            equity_compensation_expense_account_id: input.equityCompensationExpenseAccountId ?? null,
            default_bank_account_id: input.defaultBankAccountId,
          },
        })
        .where(eq(integrations.id, integration.id));

      await inngest.send({
        name: "quickbooks/sync-integration",
        data: { companyId: String(ctx.company.id) },
      });
    }),
});
