import "server-only";
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";
import { customAlphabet } from "nanoid";
import { deterministicEncryptedString, encryptedJson, encryptedString } from "@/lib/encryptedField";
import {
  BusinessType,
  companyUpdatePeriods,
  DocumentTemplateType,
  DocumentType,
  invoiceStatuses,
  optionGrantIssueDateRelationships,
  optionGrantTypes,
  optionGrantVestingTriggers,
  PayRateType,
  TaxClassification,
} from "./enums";
import type { QuickbooksIntegrationConfiguration } from "./json";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 13);

export const equityGrantTransactionsTransactionType = pgEnum("equity_grant_transactions_transaction_type", [
  "scheduled_vesting",
  "vesting_post_invoice_payment",
  "exercise",
  "cancellation",
  "manual_adjustment",
  "end_of_period_forfeiture",
]);
export const equityGrantsIssueDateRelationship = pgEnum(
  "equity_grants_issue_date_relationship",
  optionGrantIssueDateRelationships,
);
export const equityGrantsOptionGrantType = pgEnum("equity_grants_option_grant_type", optionGrantTypes);
export const equityGrantsVestingTrigger = pgEnum("equity_grants_vesting_trigger", optionGrantVestingTriggers);
export const integrationStatus = pgEnum("integration_status", ["initialized", "active", "out_of_sync", "deleted"]);
export const taxDocumentsStatus = pgEnum("tax_documents_status", ["initialized", "submitted", "deleted"]);
export const invoicesInvoiceType = pgEnum("invoices_invoice_type", ["services", "other"]);
export const activeStorageVariantRecords = pgTable(
  "active_storage_variant_records",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    blobId: bigint("blob_id", { mode: "bigint" }).notNull(),
    variationDigest: varchar("variation_digest").notNull(),
  },
  (table) => [
    uniqueIndex("index_active_storage_variant_records_uniqueness").using(
      "btree",
      table.blobId.asc().nullsLast().op("int8_ops"),
      table.variationDigest.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.blobId],
      foreignColumns: [activeStorageBlobs.id],
      name: "fk_rails_993965df05",
    }),
  ],
);

export const balanceTransactions = pgTable(
  "balance_transactions",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    consolidatedPaymentId: bigint("consolidated_payment_id", { mode: "bigint" }),
    paymentId: bigint("payment_id", { mode: "bigint" }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    type: varchar().notNull(),
    transactionType: varchar("transaction_type"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_balance_transactions_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_balance_transactions_on_consolidated_payment_id").using(
      "btree",
      table.consolidatedPaymentId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_balance_transactions_on_payment_id").using("btree", table.paymentId.asc().nullsLast().op("int8_ops")),
  ],
);

export const balances = pgTable(
  "balances",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).default(BigInt(0)).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("index_balances_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops"))],
);

export const companyAdministrators = pgTable(
  "company_administrators",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    externalId: varchar("external_id").$default(nanoid).notNull(),
  },
  (table) => [
    index("index_company_administrators_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_company_administrators_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_company_administrators_on_user_id_and_company_id").using(
      "btree",
      table.userId.asc().nullsLast().op("int8_ops"),
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
    uniqueIndex("index_company_administrators_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const companyLawyers = pgTable(
  "company_lawyers",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_company_lawyers_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_company_lawyers_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
    index("index_company_lawyers_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_company_lawyers_on_user_id_and_company_id").using(
      "btree",
      table.userId.asc().nullsLast().op("int8_ops"),
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const companyMonthlyFinancialReports = pgTable(
  "company_monthly_financial_reports",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    year: integer().notNull(),
    month: integer().notNull(),
    netIncomeCents: bigint("net_income_cents", { mode: "bigint" }).notNull(),
    revenueCents: bigint("revenue_cents", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_company_monthly_financial_reports_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
    uniqueIndex("index_company_monthly_financials_on_company_year_month").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
      table.year.asc().nullsLast().op("int4_ops"),
      table.month.asc().nullsLast().op("int4_ops"),
    ),
  ],
);

export const companyStripeAccounts = pgTable(
  "company_stripe_accounts",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    status: varchar().default("initial").notNull(),
    setupIntentId: varchar("setup_intent_id").notNull(),
    bankAccountLastFour: varchar("bank_account_last_four"),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_company_stripe_accounts_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const consolidatedInvoices = pgTable(
  "consolidated_invoices",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    periodStartDate: date("period_start_date", { mode: "string" }).notNull(),
    periodEndDate: date("period_end_date", { mode: "string" }).notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    totalCents: bigint("total_cents", { mode: "bigint" }).notNull(),
    flexileFeeCents: bigint("flexile_fee_cents", { mode: "bigint" }).notNull(),
    transferFeeCents: bigint("transfer_fee_cents", { mode: "bigint" }).notNull(),
    invoiceAmountCents: bigint("invoice_amount_cents", { mode: "bigint" }).notNull(),
    paidAt: timestamp("paid_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    status: varchar().notNull(),
    invoiceNumber: varchar("invoice_number").notNull(),
  },
  (table) => [
    index("index_consolidated_invoices_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
  ],
);

export const consolidatedInvoicesInvoices = pgTable(
  "consolidated_invoices_invoices",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    consolidatedInvoiceId: bigint("consolidated_invoice_id", { mode: "bigint" }).notNull(),
    invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_consolidated_invoices_invoices_on_consolidated_invoice_id").using(
      "btree",
      table.consolidatedInvoiceId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_consolidated_invoices_invoices_on_invoice_id").using(
      "btree",
      table.invoiceId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const consolidatedPayments = pgTable(
  "consolidated_payments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    consolidatedInvoiceId: bigint("consolidated_invoice_id", { mode: "bigint" }).notNull(),
    stripeFeeCents: bigint("stripe_fee_cents", { mode: "bigint" }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    stripeTransactionId: varchar("stripe_transaction_id"),
    succeededAt: timestamp("succeeded_at", { precision: 6, mode: "date" }),
    stripePayoutId: varchar("stripe_payout_id"),
    triggerPayoutAfter: timestamp("trigger_payout_after", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    status: varchar().default("initial").notNull(),
    bankAccountLastFour: varchar("bank_account_last_four"),
  },
  (table) => [
    index("index_consolidated_payments_on_consolidated_invoice_id").using(
      "btree",
      table.consolidatedInvoiceId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const convertibleInvestments = pgTable(
  "convertible_investments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    companyValuationInDollars: bigint("company_valuation_in_dollars", { mode: "bigint" }).notNull(),
    amountInCents: bigint("amount_in_cents", { mode: "bigint" }).notNull(),
    impliedShares: bigint("implied_shares", { mode: "bigint" }).notNull(),
    valuationType: varchar("valuation_type").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    identifier: varchar().notNull(),
    entityName: varchar("entity_name").notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    convertibleType: varchar("convertible_type").notNull(),
  },
  (table) => [
    index("index_convertible_investments_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const convertibleSecurities = pgTable(
  "convertible_securities",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    principalValueInCents: bigint("principal_value_in_cents", { mode: "bigint" }).notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    convertibleInvestmentId: bigint("convertible_investment_id", { mode: "bigint" }).notNull(),
    impliedShares: numeric("implied_shares").notNull(),
  },
  (table) => [
    index("index_convertible_securities_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_convertible_securities_on_convertible_investment_id").using(
      "btree",
      table.convertibleInvestmentId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const dividendComputationOutputs = pgTable(
  "dividend_computation_outputs",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    dividendComputationId: bigint("dividend_computation_id", { mode: "bigint" }).notNull(),
    shareClass: varchar("share_class").notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }).notNull(),
    hurdleRate: numeric("hurdle_rate"),
    originalIssuePriceInUsd: numeric("original_issue_price_in_usd"),
    preferredDividendAmountInUsd: numeric("preferred_dividend_amount_in_usd").notNull(),
    dividendAmountInUsd: numeric("dividend_amount_in_usd").notNull(),
    totalAmountInUsd: numeric("total_amount_in_usd").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    investorName: varchar("investor_name"),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }),
    qualifiedDividendAmountUsd: numeric("qualified_dividend_amount_usd").notNull(),
  },
  (table) => [
    index("index_dividend_computation_outputs_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_dividend_computation_outputs_on_dividend_computation_id").using(
      "btree",
      table.dividendComputationId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const dividendPayments = pgTable(
  "dividend_payments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    status: varchar().notNull(),
    processorUuid: varchar("processor_uuid"),
    wiseQuoteId: varchar("wise_quote_id"),
    transferId: varchar("transfer_id"),
    transferStatus: varchar("transfer_status"),
    transferAmount: numeric("transfer_amount"),
    transferCurrency: varchar("transfer_currency"),
    wiseTransferEstimate: timestamp("wise_transfer_estimate", { precision: 6, mode: "date" }),
    recipientLast4: varchar("recipient_last4"),
    conversionRate: numeric("conversion_rate"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    totalTransactionCents: bigint("total_transaction_cents", { mode: "bigint" }),
    wiseCredentialId: bigint("wise_credential_id", { mode: "bigint" }),
    transferFeeInCents: bigint("transfer_fee_in_cents", { mode: "bigint" }),
    processorName: varchar("processor_name").notNull(),
    wiseRecipientId: bigint("wise_recipient_id", { mode: "bigint" }),
  },
  (table) => [
    index("index_dividend_payments_on_wise_recipient_id").using(
      "btree",
      table.wiseRecipientId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const dividendComputations = pgTable(
  "dividend_computations",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    totalAmountInUsd: numeric("total_amount_in_usd").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    dividendsIssuanceDate: date("dividends_issuance_date", { mode: "string" }).notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    returnOfCapital: boolean("return_of_capital").notNull(),
  },
  (table) => [
    index("index_dividend_computations_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_dividend_computations_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const dividendRounds = pgTable(
  "dividend_rounds",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }).notNull(),
    numberOfShareholders: bigint("number_of_shareholders", { mode: "bigint" }).notNull(),
    totalAmountInCents: bigint("total_amount_in_cents", { mode: "bigint" }).notNull(),
    status: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    returnOfCapital: boolean("return_of_capital").notNull(),
    readyForPayment: boolean("ready_for_payment").notNull().default(false),
    releaseDocument: text("release_document"),
  },
  (table) => [
    index("index_dividend_rounds_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_dividend_rounds_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const dividends = pgTable(
  "dividends",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    dividendRoundId: bigint("dividend_round_id", { mode: "bigint" }).notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    totalAmountInCents: bigint("total_amount_in_cents", { mode: "bigint" }).notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }),
    paidAt: timestamp("paid_at", { precision: 6, mode: "date" }),
    status: varchar().$type<"Issued" | "Processing" | "Retained" | "Paid" | "Pending signup">().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    retainedReason: varchar("retained_reason"),
    withheldTaxCents: bigint("withheld_tax_cents", { mode: "bigint" }),
    netAmountInCents: bigint("net_amount_in_cents", { mode: "bigint" }),
    withholdingPercentage: integer("withholding_percentage"),
    userComplianceInfoId: bigint("user_compliance_info_id", { mode: "bigint" }),
    qualifiedAmountCents: bigint("qualified_amount_cents", { mode: "bigint" }).notNull(),
    signedReleaseAt: timestamp("signed_release_at", { precision: 6, mode: "date" }),
  },
  (table) => [
    index("index_dividends_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_dividends_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_dividends_on_dividend_round_id").using(
      "btree",
      table.dividendRoundId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_dividends_on_user_compliance_info_id").using(
      "btree",
      table.userComplianceInfoId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const dividendsDividendPayments = pgTable(
  "dividends_dividend_payments",
  {
    dividendId: bigint("dividend_id", { mode: "bigint" }).notNull(),
    dividendPaymentId: bigint("dividend_payment_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_dividends_dividend_payments_on_dividend_id").using(
      "btree",
      table.dividendId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_dividends_dividend_payments_on_dividend_payment_id").using(
      "btree",
      table.dividendPaymentId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }),
    name: varchar().notNull(),
    type: integer("document_type").$type<DocumentTemplateType>().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    docusealId: bigint("docuseal_id", { mode: "bigint" }).notNull(),
    signable: boolean("signable").notNull().default(false),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_document_templates_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_document_templates_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("index_document_templates_on_docuseal_id").using(
      "btree",
      table.docusealId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    userComplianceInfoId: bigint("user_compliance_info_id", { mode: "bigint" }),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }),
    name: varchar().notNull(),
    type: integer("document_type").$type<DocumentType>().notNull(),
    year: integer().notNull(),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
    emailedAt: timestamp("emailed_at", { precision: 6, mode: "date" }),
    jsonData: jsonb("json_data"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    docusealSubmissionId: integer("docuseal_submission_id"),
  },
  (table) => [
    index("index_documents_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_documents_on_equity_grant_id").using("btree", table.equityGrantId.asc().nullsLast().op("int8_ops")),
    index("index_documents_on_user_compliance_info_id").using(
      "btree",
      table.userComplianceInfoId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_documents_on_docuseal_submission_id").using(
      "btree",
      table.docusealSubmissionId.asc().nullsLast().op("int4_ops"),
    ),
  ],
);

export const documentSignatures = pgTable(
  "document_signatures",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    documentId: bigint("document_id", { mode: "bigint" }).notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    title: varchar("title").notNull(),
    signedAt: timestamp("signed_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("index_document_signatures_on_document_id").using("btree", table.documentId.asc().nullsLast().op("int8_ops")),
    index("index_document_signatures_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
  ],
);

export const equityExerciseBankAccounts = pgTable(
  "equity_exercise_bank_accounts",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    details: jsonb().notNull(),
    accountNumber: encryptedString("account_number").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_equity_exercise_bank_accounts_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const equityGrantExercises = pgTable(
  "equity_grant_exercises",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    requestedAt: timestamp("requested_at", { precision: 6, mode: "date" }).notNull(),
    signedAt: timestamp("signed_at", { precision: 6, mode: "date" }),
    numberOfOptions: bigint("number_of_options", { mode: "bigint" }).notNull(),
    totalCostCents: bigint("total_cost_cents", { mode: "bigint" }).notNull(),
    status: varchar().notNull(),
    bankReference: varchar("bank_reference").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    equityExerciseBankAccountId: bigint("equity_exercise_bank_account_id", { mode: "bigint" }),
  },
  (table) => [
    index("idx_on_equity_exercise_bank_account_id_92fefd4aa1").using(
      "btree",
      table.equityExerciseBankAccountId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_exercises_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_exercises_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const integrationRecords = pgTable(
  "integration_records",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    integrationId: bigint("integration_id", { mode: "bigint" }).notNull(),
    integratableType: varchar("integratable_type"),
    integratableId: bigint("integratable_id", { mode: "bigint" }),
    integrationExternalId: varchar("integration_external_id").notNull(),
    syncToken: varchar("sync_token"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),

    jsonData: jsonb("json_data"),
    quickbooksJournalEntry: boolean("quickbooks_journal_entry").notNull().default(false),
  },
  (table) => [
    index("index_integration_records_on_integratable").using(
      "btree",
      table.integratableType.asc().nullsLast().op("int8_ops"),
      table.integratableId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_integration_records_on_integration_id").using(
      "btree",
      table.integrationId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    name: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    expenseAccountId: varchar("expense_account_id"),
  },
  (table) => [
    index("index_expense_categories_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
  ],
);

export const integrations = pgTable(
  "integrations",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    type: varchar().notNull().$type<"QuickbooksIntegration">(),
    status: integrationStatus().default("initialized").notNull(),
    configuration: encryptedJson().$type<QuickbooksIntegrationConfiguration>(),
    syncError: text("sync_error"),
    lastSyncAt: timestamp("last_sync_at", { precision: 6, mode: "date" }),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    accountId: varchar("account_id").notNull(),
  },
  (table) => [
    index("index_integrations_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("unique_active_integration_types")
      .using("btree", table.companyId.asc().nullsLast().op("int8_ops"), table.type.asc().nullsLast().op("int8_ops"))
      .where(sql`(deleted_at IS NULL)`),
  ],
);

export const invoiceApprovals = pgTable(
  "invoice_approvals",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
    approverId: bigint("approver_id", { mode: "bigint" }).notNull(),
    approvedAt: timestamp("approved_at", { precision: 6, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_approvals_on_invoice_and_approver").using(
      "btree",
      table.invoiceId.asc().nullsLast().op("int8_ops"),
      table.approverId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_invoice_approvals_on_approver_id").using("btree", table.approverId.asc().nullsLast().op("int8_ops")),
    index("index_invoice_approvals_on_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
  ],
);

export const invoiceExpenses = pgTable(
  "invoice_expenses",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
    expenseCategoryId: bigint("expense_category_id", { mode: "bigint" }).notNull(),
    totalAmountInCents: bigint("total_amount_in_cents", { mode: "bigint" }).notNull(),
    description: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_invoice_expenses_on_expense_category_id").using(
      "btree",
      table.expenseCategoryId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_invoice_expenses_on_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
  ],
);

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
    description: varchar().notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    hourly: boolean().default(false).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    payRateInSubunits: integer("pay_rate_in_subunits").notNull(),
    payRateCurrency: varchar("pay_rate_currency").default("usd").notNull(),
  },
  (table) => [
    index("index_invoice_line_items_on_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    createdById: bigint("created_by_id", { mode: "bigint" }).notNull(),
    invoiceType: invoicesInvoiceType("invoice_type").default("services").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    totalAmountInUsdCents: bigint("total_amount_in_usd_cents", { mode: "bigint" }).notNull(),
    status: varchar({ enum: invoiceStatuses }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    invoiceNumber: varchar("invoice_number").notNull(),
    description: varchar(),
    paidAt: timestamp("paid_at", { precision: 6, mode: "date" }),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    billFrom: varchar("bill_from").notNull(),
    billTo: varchar("bill_to").notNull(),
    notes: text(),
    invoiceApprovalsCount: integer("invoice_approvals_count").default(0).notNull(),
    equityPercentage: integer("equity_percentage").notNull(),
    minAllowedEquityPercentage: integer("min_allowed_equity_percentage"),
    maxAllowedEquityPercentage: integer("max_allowed_equity_percentage"),
    equityAmountInCents: bigint("equity_amount_in_cents", { mode: "bigint" }).notNull(),
    equityAmountInOptions: integer("equity_amount_in_options").notNull(),
    cashAmountInCents: bigint("cash_amount_in_cents", { mode: "bigint" }).notNull(),
    companyContractorId: bigint("company_contractor_id", { mode: "bigint" }).notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }),
    rejectedById: bigint("rejected_by_id", { mode: "bigint" }),
    rejectionReason: varchar("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { precision: 6, mode: "date" }),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    streetAddress: varchar("street_address"),
    city: varchar(),
    state: varchar(),
    zipCode: varchar("zip_code"),
    flexileFeeCents: bigint("flexile_fee_cents", { mode: "bigint" }),
    countryCode: varchar("country_code"),
    acceptedAt: timestamp("accepted_at", { precision: 6, mode: "date" }),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
  },
  (table) => [
    index("index_invoices_on_company_contractor_id").using(
      "btree",
      table.companyContractorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_invoices_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_invoices_on_equity_grant_id").using("btree", table.equityGrantId.asc().nullsLast().op("int8_ops")),
    uniqueIndex("index_invoices_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_invoices_on_rejected_by_id").using("btree", table.rejectedById.asc().nullsLast().op("int8_ops")),
    index("index_invoices_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    invoiceId: bigint("invoice_id", { mode: "bigint" }).notNull(),
    status: varchar().default("initial").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    processorUuid: varchar("processor_uuid"),
    wiseQuoteId: varchar("wise_quote_id"),
    wiseTransferId: varchar("wise_transfer_id"),
    wiseTransferStatus: varchar("wise_transfer_status"),
    wiseTransferAmount: numeric("wise_transfer_amount"),
    wiseTransferCurrency: varchar("wise_transfer_currency"),
    wiseTransferEstimate: timestamp("wise_transfer_estimate", { precision: 6, mode: "date" }),
    recipientLast4: varchar("recipient_last4"),
    conversionRate: numeric("conversion_rate"),
    wiseCredentialId: bigint("wise_credential_id", { mode: "bigint" }),
    netAmountInCents: bigint("net_amount_in_cents", { mode: "bigint" }).notNull(),
    transferFeeInCents: bigint("transfer_fee_in_cents", { mode: "bigint" }),
    wiseRecipientId: bigint("wise_recipient_id", { mode: "bigint" }),
  },
  (table) => [
    index("index_payments_on_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("int8_ops")),
    index("index_payments_on_wise_credential_id").using(
      "btree",
      table.wiseCredentialId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_payments_on_wise_recipient_id").using("btree", table.wiseRecipientId.asc().nullsLast().op("int8_ops")),
  ],
);

export const pgSearchDocuments = pgTable(
  "pg_search_documents",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    content: text(),
    companyId: bigint("company_id", { mode: "bigint" }),
    searchableType: varchar("searchable_type"),
    searchableId: bigint("searchable_id", { mode: "bigint" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_pg_search_documents_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_pg_search_documents_on_searchable").using(
      "btree",
      table.searchableType.asc().nullsLast().op("int8_ops"),
      table.searchableId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const shareClasses = pgTable(
  "share_classes",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    name: varchar().notNull(),
    originalIssuePriceInDollars: numeric("original_issue_price_in_dollars"),
    hurdleRate: numeric("hurdle_rate"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),

    preferred: boolean().notNull().default(false),
  },
  (table) => [
    index("index_share_classes_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
  ],
);

export const shareHoldings = pgTable(
  "share_holdings",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }),
    name: varchar().notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    numberOfShares: integer("number_of_shares").notNull(),
    totalAmountInCents: bigint("total_amount_in_cents", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    shareClassId: bigint("share_class_id", { mode: "bigint" }).notNull(),
    shareHolderName: varchar("share_holder_name").notNull(),
    sharePriceUsd: numeric("share_price_usd").notNull(),
    originallyAcquiredAt: timestamp("originally_acquired_at", { precision: 6, mode: "date" }).notNull(),
    companyInvestorEntityId: bigint("company_investor_entity_id", { mode: "bigint" }),
  },
  (table) => [
    index("index_share_holdings_on_company_investor_entity_id").using(
      "btree",
      table.companyInvestorEntityId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_share_holdings_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_share_holdings_on_equity_grant_id").using(
      "btree",
      table.equityGrantId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_share_holdings_on_share_class_id").using("btree", table.shareClassId.asc().nullsLast().op("int8_ops")),
  ],
);

export const taxDocuments = pgTable(
  "tax_documents",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    name: varchar().notNull(),
    taxYear: integer("tax_year").notNull(),
    status: taxDocumentsStatus().default("initialized").notNull(),
    submittedAt: timestamp("submitted_at", { precision: 6, mode: "date" }),
    emailedAt: timestamp("emailed_at", { precision: 6, mode: "date" }),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
    userComplianceInfoId: bigint("user_compliance_info_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
  },
  (table) => [
    index("idx_on_name_tax_year_user_compliance_info_id_a24b2e6c51")
      .using(
        "btree",
        table.name.asc().nullsLast().op("int4_ops"),
        table.taxYear.asc().nullsLast().op("int8_ops"),
        table.userComplianceInfoId.asc().nullsLast().op("text_ops"),
      )
      .where(sql`(status <> 'deleted'::tax_documents_status)`),
    index("index_tax_documents_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_tax_documents_on_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
    index("index_tax_documents_on_user_compliance_info_id").using(
      "btree",
      table.userComplianceInfoId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const tosAgreements = pgTable(
  "tos_agreements",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    ipAddress: varchar("ip_address").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("index_tos_agreements_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops"))],
);

export const userLeads = pgTable(
  "user_leads",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    email: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("index_user_leads_on_email").using("btree", table.email.asc().nullsLast().op("text_ops"))],
);

export const versions = pgTable(
  "versions",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    itemType: varchar("item_type").notNull(),
    itemId: bigint("item_id", { mode: "bigint" }).notNull(),
    event: varchar().notNull(),
    whodunnit: varchar(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }),
    remoteIp: varchar("remote_ip"),
    requestPath: text("request_path"),
    requestUuid: varchar("request_uuid"),
    object: json(),
    objectChanges: json("object_changes"),
  },
  (table) => [
    index("index_versions_on_item_type_and_item_id").using(
      "btree",
      table.itemType.asc().nullsLast().op("int8_ops"),
      table.itemId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const wiseCredentials = pgTable("wise_credentials", {
  id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
  profileId: deterministicEncryptedString("profile_id").notNull(),
  apiKey: encryptedString("api_key").notNull(),
  deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const wiseRecipients = pgTable(
  "wise_recipients",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    recipientId: varchar("recipient_id").notNull(),
    bankName: varchar("bank_name"),
    lastFourDigits: varchar("last_four_digits"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    currency: varchar(),
    countryCode: varchar("country_code").notNull(),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),
    wiseCredentialId: bigint("wise_credential_id", { mode: "bigint" }),
    usedForInvoices: boolean("used_for_invoices").default(false).notNull(),
    usedForDividends: boolean("used_for_dividends").default(false).notNull(),
    accountHolderName: varchar("account_holder_name"),
  },
  (table) => [
    index("index_wise_recipients_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    index("index_wise_recipients_on_user_id_and_used_for_dividends")
      .using(
        "btree",
        table.userId.asc().nullsLast().op("bool_ops"),
        table.usedForDividends.asc().nullsLast().op("bool_ops"),
      )
      .where(sql`((user_id IS NOT NULL) AND (deleted_at IS NULL) AND (used_for_dividends IS TRUE))`),
    index("index_wise_recipients_on_user_id_and_used_for_invoices")
      .using(
        "btree",
        table.userId.asc().nullsLast().op("int8_ops"),
        table.usedForInvoices.asc().nullsLast().op("int8_ops"),
      )
      .where(sql`((user_id IS NOT NULL) AND (deleted_at IS NULL) AND (used_for_invoices IS TRUE))`),
    index("index_wise_recipients_on_wise_credential_id").using(
      "btree",
      table.wiseCredentialId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const activeStorageBlobs = pgTable(
  "active_storage_blobs",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    key: varchar().notNull(),
    filename: varchar().notNull(),
    contentType: varchar("content_type"),
    metadata: text(),
    serviceName: varchar("service_name").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    checksum: varchar(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("index_active_storage_blobs_on_key").using("btree", table.key.asc().nullsLast().op("text_ops"))],
);

export const activeStorageAttachments = pgTable(
  "active_storage_attachments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    name: varchar().notNull(),
    recordType: varchar("record_type").notNull(),
    recordId: bigint("record_id", { mode: "bigint" }).notNull(),
    blobId: bigint("blob_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("index_active_storage_attachments_on_blob_id").using("btree", table.blobId.asc().nullsLast().op("int8_ops")),
    index("index_active_storage_attachments_uniqueness").using(
      "btree",
      table.recordType.asc().nullsLast().op("text_ops"),
      table.recordId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("int8_ops"),
      table.blobId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.blobId],
      foreignColumns: [activeStorageBlobs.id],
      name: "fk_rails_c3b3935057",
    }),
  ],
);

export const schemaMigrations = pgTable("schema_migrations", {
  version: varchar().primaryKey().notNull(),
});

export const arInternalMetadata = pgTable("ar_internal_metadata", {
  key: varchar().primaryKey().notNull(),
  value: varchar(),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tenderOfferBids = pgTable(
  "tender_offer_bids",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    tenderOfferId: bigint("tender_offer_id", { mode: "bigint" }).notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    numberOfShares: numeric("number_of_shares").notNull(),
    sharePriceCents: integer("share_price_cents").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    shareClass: varchar("share_class").notNull(),
    acceptedShares: numeric("accepted_shares").default("0.0").notNull(),
  },
  (table) => [
    index("index_tender_offer_bids_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_tender_offer_bids_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_tender_offer_bids_on_tender_offer_id").using(
      "btree",
      table.tenderOfferId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const financingRounds = pgTable(
  "financing_rounds",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    name: varchar().notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    sharesIssued: bigint("shares_issued", { mode: "bigint" }).notNull(),
    pricePerShareCents: bigint("price_per_share_cents", { mode: "bigint" }).notNull(),
    amountRaisedCents: bigint("amount_raised_cents", { mode: "bigint" }).notNull(),
    postMoneyValuationCents: bigint("post_money_valuation_cents", { mode: "bigint" }).notNull(),
    investors: jsonb().default([]).$type<{ name: string; amount_invested_cents: number }[]>().notNull(),
    status: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_financing_rounds_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_financing_rounds_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);
export const equityBuybackRounds = pgTable(
  "equity_buyback_rounds",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    tenderOfferId: bigint("tender_offer_id", { mode: "bigint" }).notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }).notNull(),
    numberOfShareholders: bigint("number_of_shareholders", { mode: "bigint" }).notNull(),
    totalAmountCents: bigint("total_amount_cents", { mode: "bigint" }).notNull(),
    status: varchar().notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    readyForPayment: boolean("ready_for_payment").notNull().default(false),
  },
  (table) => [
    index("index_equity_buyback_rounds_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_equity_buyback_rounds_on_tender_offer_id").using(
      "btree",
      table.tenderOfferId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const tenderOffers = pgTable(
  "tender_offers",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    startsAt: timestamp("starts_at", { precision: 6, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { precision: 6, mode: "date" }).notNull(),
    minimumValuation: bigint("minimum_valuation", { mode: "bigint" }).notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }),
    numberOfShareholders: integer("number_of_shareholders"),
    totalAmountInCents: bigint("total_amount_in_cents", { mode: "bigint" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    acceptedPriceCents: integer("accepted_price_cents"),
  },
  (table) => [
    index("index_tender_offers_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_tender_offers_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);

export const equityBuybackPayments = pgTable("equity_buyback_payments", {
  id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
  status: varchar().notNull(),
  processorUuid: varchar("processor_uuid"),
  wiseQuoteId: varchar("wise_quote_id"),
  transferId: varchar("transfer_id"),
  transferStatus: varchar("transfer_status"),
  transferAmount: numeric("transfer_amount"),
  transferCurrency: varchar("transfer_currency"),
  wiseTransferEstimate: timestamp("wise_transfer_estimate", { precision: 6, mode: "date" }),
  recipientLast4: varchar("recipient_last4"),
  conversionRate: numeric("conversion_rate"),
  totalTransactionCents: bigint("total_transaction_cents", { mode: "bigint" }),
  wiseCredentialId: bigint("wise_credential_id", { mode: "bigint" }),
  transferFeeCents: bigint("transfer_fee_cents", { mode: "bigint" }),
  processorName: varchar("processor_name").notNull(),
  wiseRecipientId: bigint("wise_recipient_id", { mode: "bigint" }),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const companyInvestors = pgTable(
  "company_investors",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    totalShares: bigint("total_shares", { mode: "bigint" }).default(0n).notNull(),
    investmentAmountInCents: bigint("investment_amount_in_cents", { mode: "bigint" }).notNull(),
    capTableNotes: varchar("cap_table_notes"),

    externalId: varchar("external_id").$default(nanoid).notNull(),
    totalOptions: bigint("total_options", { mode: "bigint" }).default(0n).notNull(),
    fullyDilutedShares: bigint("fully_diluted_shares", { mode: "bigint" }).generatedAlwaysAs(
      sql`(total_shares + total_options)`,
    ),

    investedInAngelListRuv: boolean("invested_in_angel_list_ruv").notNull().default(false),
  },
  (table) => [
    index("index_company_investors_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_company_investors_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_company_investors_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    index("index_company_investors_on_user_id_and_company_id").using(
      "btree",
      table.userId.asc().nullsLast().op("int8_ops"),
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const equityBuybacksEquityBuybackPayments = pgTable(
  "equity_buybacks_equity_buyback_payments",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    equityBuybackId: bigint("equity_buyback_id", { mode: "bigint" }).notNull(),
    equityBuybackPaymentId: bigint("equity_buyback_payment_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_on_equity_buyback_id_fa143c8057").using("btree", table.equityBuybackId.asc().nullsLast().op("int8_ops")),
    index("idx_on_equity_buyback_payment_id_146a2cc767").using(
      "btree",
      table.equityBuybackPaymentId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const equityBuybacks = pgTable(
  "equity_buybacks",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    equityBuybackRoundId: bigint("equity_buyback_round_id", { mode: "bigint" }).notNull(),
    totalAmountCents: bigint("total_amount_cents", { mode: "bigint" }).notNull(),
    sharePriceCents: bigint("share_price_cents", { mode: "bigint" }).notNull(),
    exercisePriceCents: bigint("exercise_price_cents", { mode: "bigint" }).notNull(),
    numberOfShares: bigint("number_of_shares", { mode: "bigint" }),
    paidAt: timestamp("paid_at", { precision: 6, mode: "date" }),
    status: varchar().notNull(),
    retainedReason: varchar("retained_reason"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    securityType: varchar("security_type").notNull(),
    securityId: bigint("security_id", { mode: "bigint" }).notNull(),
    shareClass: varchar("share_class").notNull(),
  },
  (table) => [
    index("index_equity_buybacks_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_equity_buybacks_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_buybacks_on_equity_buyback_round_id").using(
      "btree",
      table.equityBuybackRoundId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_buybacks_on_security").using(
      "btree",
      table.securityType.asc().nullsLast().op("int8_ops"),
      table.securityId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const equityGrantExerciseRequests = pgTable(
  "equity_grant_exercise_requests",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }).notNull(),
    equityGrantExerciseId: bigint("equity_grant_exercise_id", { mode: "bigint" }).notNull(),
    numberOfOptions: integer("number_of_options").notNull(),
    exercisePriceUsd: numeric("exercise_price_usd").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    shareHoldingId: bigint("share_holding_id", { mode: "bigint" }),
  },
  (table) => [
    index("idx_on_equity_grant_exercise_id_7be508b15c").using(
      "btree",
      table.equityGrantExerciseId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_exercise_requests_on_equity_grant_id").using(
      "btree",
      table.equityGrantId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_exercise_requests_on_share_holding_id").using(
      "btree",
      table.shareHoldingId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const optionPools = pgTable(
  "option_pools",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    name: varchar().notNull(),
    authorizedShares: bigint("authorized_shares", { mode: "bigint" }).notNull(),
    issuedShares: bigint("issued_shares", { mode: "bigint" }).notNull(),
    availableShares: bigint("available_shares", { mode: "bigint" })
      .notNull()
      .generatedAlwaysAs(sql`(authorized_shares - issued_shares)`),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    shareClassId: bigint("share_class_id", { mode: "bigint" }).notNull(),
    defaultOptionExpiryMonths: integer("default_option_expiry_months").default(120).notNull(),
    voluntaryTerminationExerciseMonths: integer("voluntary_termination_exercise_months").default(120).notNull(),
    involuntaryTerminationExerciseMonths: integer("involuntary_termination_exercise_months").default(120).notNull(),
    terminationWithCauseExerciseMonths: integer("termination_with_cause_exercise_months").default(0).notNull(),
    deathExerciseMonths: integer("death_exercise_months").default(120).notNull(),
    disabilityExerciseMonths: integer("disability_exercise_months").default(120).notNull(),
    retirementExerciseMonths: integer("retirement_exercise_months").default(120).notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
  },
  (table) => [
    index("index_option_pools_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_option_pools_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_option_pools_on_share_class_id").using("btree", table.shareClassId.asc().nullsLast().op("int8_ops")),
  ],
);

export const companyInvestorEntities = pgTable(
  "company_investor_entities",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    name: varchar().notNull(),
    investmentAmountCents: bigint("investment_amount_cents", { mode: "bigint" }).notNull(),
    capTableNotes: varchar("cap_table_notes"),
    totalShares: bigint("total_shares", { mode: "bigint" }).default(0n).notNull(),
    totalOptions: bigint("total_options", { mode: "bigint" }).default(0n).notNull(),
    fullyDilutedShares: bigint("fully_diluted_shares", { mode: "bigint" }).generatedAlwaysAs(
      sql`(total_shares + total_options)`,
    ),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    email: varchar().notNull(),
  },
  (table) => [
    index("idx_on_company_id_email_name_6c6bac5ed9").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
      table.email.asc().nullsLast().op("int8_ops"),
      table.name.asc().nullsLast().op("int8_ops"),
    ),
    index("index_company_investor_entities_on_company_id").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_company_investor_entities_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const vestingSchedules = pgTable(
  "vesting_schedules",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    totalVestingDurationMonths: integer("total_vesting_duration_months").notNull(),
    cliffDurationMonths: integer("cliff_duration_months").notNull(),
    vestingFrequencyMonths: integer("vesting_frequency_months").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_vesting_schedule_option").using(
      "btree",
      table.totalVestingDurationMonths.asc().nullsLast().op("int4_ops"),
      table.cliffDurationMonths.asc().nullsLast().op("int4_ops"),
      table.vestingFrequencyMonths.asc().nullsLast().op("int4_ops"),
    ),
    index("index_vesting_schedules_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);

export const vestingEvents = pgTable(
  "vesting_events",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }).notNull(),
    vestingDate: timestamp("vesting_date", { precision: 6, mode: "date" }).notNull(),
    vestedShares: bigint("vested_shares", { mode: "bigint" }).notNull(),
    processedAt: timestamp("processed_at", { precision: 6, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { precision: 6, mode: "date" }),
    cancellationReason: varchar("cancellation_reason"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("index_vesting_events_on_equity_grant_id").using(
      "btree",
      table.equityGrantId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_vesting_events_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);

export const equityGrants = pgTable(
  "equity_grants",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    name: varchar().notNull(),
    periodStartedAt: timestamp("period_started_at", { precision: 6, mode: "date" }).notNull(),
    periodEndedAt: timestamp("period_ended_at", { precision: 6, mode: "date" }).notNull(),
    numberOfShares: integer("number_of_shares").notNull(),
    exercisedAt: timestamp("exercised_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    optionPoolId: bigint("option_pool_id", { mode: "bigint" }).notNull(),
    vestedShares: integer("vested_shares").notNull(),
    exercisedShares: integer("exercised_shares").notNull(),
    forfeitedShares: integer("forfeited_shares").notNull(),
    unvestedShares: integer("unvested_shares").notNull(),
    issuedAt: timestamp("issued_at", { precision: 6, mode: "date" }).notNull(),
    cancelledAt: timestamp("cancelled_at", { precision: 6, mode: "date" }),
    optionHolderName: varchar("option_holder_name").notNull(),
    expiresAt: timestamp("expires_at", { precision: 6, mode: "date" }).notNull(),
    activeExerciseId: bigint("active_exercise_id", { mode: "bigint" }),
    sharePriceUsd: numeric("share_price_usd").notNull(),
    vestedAmountUsd: numeric("vested_amount_usd")
      .notNull()
      .generatedAlwaysAs(sql`((vested_shares)::numeric * share_price_usd)`),
    exercisePriceUsd: numeric("exercise_price_usd").notNull(),
    issueDateRelationship: equityGrantsIssueDateRelationship("issue_date_relationship").default("consultant").notNull(),
    boardApprovalDate: date("board_approval_date", { mode: "string" }),
    optionGrantType: equityGrantsOptionGrantType("option_grant_type").default("nso").notNull(),
    voluntaryTerminationExerciseMonths: integer("voluntary_termination_exercise_months").notNull(),
    involuntaryTerminationExerciseMonths: integer("involuntary_termination_exercise_months").notNull(),
    terminationWithCauseExerciseMonths: integer("termination_with_cause_exercise_months").notNull(),
    deathExerciseMonths: integer("death_exercise_months").notNull(),
    disabilityExerciseMonths: integer("disability_exercise_months").notNull(),
    retirementExerciseMonths: integer("retirement_exercise_months").notNull(),
    acceptedAt: timestamp("accepted_at", { precision: 6, mode: "date" }),
    companyInvestorEntityId: bigint("company_investor_entity_id", { mode: "bigint" }),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    vestingScheduleId: bigint("vesting_schedule_id", { mode: "bigint" }),
    vestingTrigger: equityGrantsVestingTrigger("vesting_trigger").notNull(),
  },
  (table) => [
    index("index_equity_grants_on_company_investor_entity_id").using(
      "btree",
      table.companyInvestorEntityId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grants_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grants_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_equity_grants_on_option_pool_id").using("btree", table.optionPoolId.asc().nullsLast().op("int8_ops")),
    index("index_equity_grants_on_vesting_schedule_id").using(
      "btree",
      table.vestingScheduleId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const equityGrantTransactions = pgTable(
  "equity_grant_transactions",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }).notNull(),
    transactionType: equityGrantTransactionsTransactionType("transaction_type").notNull(),
    vestingEventId: bigint("vesting_event_id", { mode: "bigint" }),
    invoiceId: bigint("invoice_id", { mode: "bigint" }),
    equityGrantExerciseId: bigint("equity_grant_exercise_id", { mode: "bigint" }),
    metadata: jsonb().default({}).notNull(),
    notes: text(),
    vestedShares: bigint("vested_shares", { mode: "bigint" }).default(0n).notNull(),
    exercisedShares: bigint("exercised_shares", { mode: "bigint" }).default(0n).notNull(),
    forfeitedShares: bigint("forfeited_shares", { mode: "bigint" }).default(0n).notNull(),
    totalNumberOfShares: bigint("total_number_of_shares", { mode: "bigint" }).notNull(),
    totalVestedShares: bigint("total_vested_shares", { mode: "bigint" }).notNull(),
    totalUnvestedShares: bigint("total_unvested_shares", { mode: "bigint" }).notNull(),
    totalExercisedShares: bigint("total_exercised_shares", { mode: "bigint" }).notNull(),
    totalForfeitedShares: bigint("total_forfeited_shares", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_equity_grant_transactions_on_all_columns").using(
      "btree",
      table.equityGrantId.asc().nullsLast().op("int8_ops"),
      table.transactionType.asc().nullsLast().op("enum_ops"),
      table.vestingEventId.asc().nullsLast().op("int8_ops"),
      table.invoiceId.asc().nullsLast().op("int8_ops"),
      table.equityGrantExerciseId.asc().nullsLast().op("enum_ops"),
    ),
    index("index_equity_grant_transactions_on_equity_grant_exercise_id").using(
      "btree",
      table.equityGrantExerciseId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_transactions_on_equity_grant_id").using(
      "btree",
      table.equityGrantId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_transactions_on_external_id").using(
      "btree",
      table.externalId.asc().nullsLast().op("text_ops"),
    ),
    index("index_equity_grant_transactions_on_invoice_id").using(
      "btree",
      table.invoiceId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_equity_grant_transactions_on_vesting_event_id").using(
      "btree",
      table.vestingEventId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const companyUpdates = pgTable(
  "company_updates",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    title: varchar().notNull(),
    body: text().notNull(),

    videoUrl: text("video_url"),
    sentAt: timestamp("sent_at", { precision: 6, mode: "date" }),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    period: varchar({ enum: companyUpdatePeriods }),
    periodStartedOn: date("period_started_on", { mode: "string" }),
    showRevenue: boolean("show_revenue").notNull().default(false),
    showNetIncome: boolean("show_net_income").notNull().default(false),
  },
  (table) => [
    index("index_company_updates_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_company_updates_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);

export const companyContractors = pgTable(
  "company_contractors",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    startedAt: timestamp("started_at", { precision: 6, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    endedAt: timestamp("ended_at", { precision: 6, mode: "date" }),
    role: varchar("role").notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    payRateType: integer("pay_rate_type").$type<PayRateType>().default(PayRateType.Hourly).notNull(),
    payRateInSubunits: integer("pay_rate_in_subunits"),
    payRateCurrency: varchar("pay_rate_currency").default("usd").notNull(),
    contractSignedElsewhere: boolean("contract_signed_elsewhere").notNull().default(false),
    equityPercentage: integer("equity_percentage").default(0).notNull(),
  },
  (table) => [
    index("index_company_contractors_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_company_contractors_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_company_contractors_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
    index("index_company_contractors_on_user_id_and_company_id").using(
      "btree",
      table.userId.asc().nullsLast().op("int8_ops"),
      table.companyId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    signedAt: timestamp("signed_at", { precision: 6, mode: "date" }),
    companyContractorId: bigint("company_contractor_id", { mode: "bigint" }),
    companyAdministratorId: bigint("company_administrator_id", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    contractorSignature: varchar("contractor_signature"),
    administratorSignature: varchar("administrator_signature").notNull(),

    name: varchar().notNull(),
    equityGrantId: bigint("equity_grant_id", { mode: "bigint" }),
    jsonData: jsonb("json_data"),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    equityOptionsPlan: boolean("equity_options_plan").notNull().default(false),
    certificate: boolean().notNull().default(false),
  },
  (table) => [
    index("index_contracts_on_company_administrator_id").using(
      "btree",
      table.companyAdministratorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_contracts_on_company_contractor_id").using(
      "btree",
      table.companyContractorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_contracts_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_contracts_on_equity_grant_id").using("btree", table.equityGrantId.asc().nullsLast().op("int8_ops")),
    index("index_contracts_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
  ],
);

export const investorDividendRounds = pgTable(
  "investor_dividend_rounds",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyInvestorId: bigint("company_investor_id", { mode: "bigint" }).notNull(),
    dividendRoundId: bigint("dividend_round_id", { mode: "bigint" }).notNull(),

    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    sanctionedCountryEmailSent: boolean("sanctioned_country_email_sent").notNull().default(false),
    payoutBelowThresholdEmailSent: boolean("payout_below_threshold_email_sent").notNull().default(false),
    dividendIssuedEmailSent: boolean("dividend_issued_email_sent").notNull().default(false),
  },
  (table) => [
    index("index_investor_dividend_round_uniqueness").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
      table.dividendRoundId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_investor_dividend_rounds_on_company_investor_id").using(
      "btree",
      table.companyInvestorId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_investor_dividend_rounds_on_dividend_round_id").using(
      "btree",
      table.dividendRoundId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const userComplianceInfos = pgTable(
  "user_compliance_infos",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    legalName: varchar("legal_name"),
    birthDate: date("birth_date", { mode: "string" }),
    taxId: encryptedString("tax_id"),
    streetAddress: varchar("street_address"),
    city: varchar(),
    state: varchar(),
    zipCode: varchar("zip_code"),
    signature: varchar(),
    businessName: varchar("business_name"),
    taxInformationConfirmedAt: timestamp("tax_information_confirmed_at", { precision: 6, mode: "date" }),
    deletedAt: timestamp("deleted_at", { precision: 6, mode: "date" }),

    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    taxIdStatus: varchar("tax_id_status"),
    countryCode: varchar("country_code"),
    citizenshipCountryCode: varchar("citizenship_country_code"),
    businessEntity: boolean("business_entity").default(false),
    businessType: integer("business_type").$type<BusinessType>(),
    taxClassification: integer("tax_classification").$type<TaxClassification>(),
  },
  (table) => [
    index("index_user_compliance_infos_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    name: varchar(),
    email: varchar().notNull(),
    registrationNumber: varchar("registration_number"),
    streetAddress: varchar("street_address"),
    city: varchar(),
    state: varchar(),
    zipCode: varchar("zip_code"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    stripeCustomerId: varchar("stripe_customer_id"),

    requiredInvoiceApprovalCount: integer("required_invoice_approval_count").default(1).notNull(),
    valuationInDollars: bigint("valuation_in_dollars", { mode: "bigint" }).default(0n).notNull(),
    fullyDilutedShares: bigint("fully_diluted_shares", { mode: "bigint" }).default(0n).notNull(),
    deactivatedAt: timestamp("deactivated_at", { precision: 6, mode: "date" }),
    sharePriceInUsd: numeric("share_price_in_usd"),
    fmvPerShareInUsd: numeric("fmv_per_share_in_usd"),
    website: varchar(),
    publicName: varchar("public_name"),
    slug: varchar(),
    taxId: varchar("tax_id"),
    phoneNumber: varchar("phone_number"),
    brandColor: varchar("brand_color"),
    registrationState: varchar("registration_state"),

    externalId: varchar("external_id").$default(nanoid).notNull(),
    countryCode: varchar("country_code"),
    isGumroad: boolean("is_gumroad").notNull().default(false),
    isTrusted: boolean("is_trusted").notNull().default(false),
    equityGrantsEnabled: boolean("equity_grants_enabled").notNull().default(false),
    showAnalyticsToContractors: boolean("show_analytics_to_contractors").notNull().default(false),
    companyUpdatesEnabled: boolean("company_updates_enabled").notNull().default(false),
    defaultCurrency: varchar("default_currency").default("usd").notNull(),

    tenderOffersEnabled: boolean("tender_offers_enabled").notNull().default(false),
    capTableEnabled: boolean("cap_table_enabled").default(false).notNull(),
    lawyersEnabled: boolean("lawyers_enabled").notNull().default(false),
    conversionSharePriceUsd: numeric("conversion_share_price_usd"),
    equityCompensationEnabled: boolean("equity_compensation_enabled").notNull().default(false),
    jsonData: jsonb("json_data").notNull().$type<{ flags: string[] }>().default({ flags: [] }),
  },
  (table) => [
    index("index_companies_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
  ],
);

export const users = pgTable(
  "users",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    email: varchar().default("").notNull(),
    encryptedPassword: varchar("encrypted_password").default("").notNull(),
    resetPasswordToken: varchar("reset_password_token"),
    resetPasswordSentAt: timestamp("reset_password_sent_at", { precision: 6, mode: "date" }),
    rememberCreatedAt: timestamp("remember_created_at", { precision: 6, mode: "date" }),
    signInCount: integer("sign_in_count").default(0).notNull(),
    currentSignInAt: timestamp("current_sign_in_at", { precision: 6, mode: "date" }),
    lastSignInAt: timestamp("last_sign_in_at", { precision: 6, mode: "date" }),
    currentSignInIp: varchar("current_sign_in_ip"),
    lastSignInIp: varchar("last_sign_in_ip"),
    confirmationToken: varchar("confirmation_token"),
    confirmedAt: timestamp("confirmed_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    confirmationSentAt: timestamp("confirmation_sent_at", { precision: 6, mode: "date" }),
    unconfirmedEmail: varchar("unconfirmed_email"),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
    invitationToken: varchar("invitation_token"),
    invitationCreatedAt: timestamp("invitation_created_at", { precision: 6, mode: "date" }),
    invitationSentAt: timestamp("invitation_sent_at", { precision: 6, mode: "date" }),
    invitationAcceptedAt: timestamp("invitation_accepted_at", { precision: 6, mode: "date" }),
    invitationLimit: integer("invitation_limit"),
    invitedByType: varchar("invited_by_type"),
    invitedById: bigint("invited_by_id", { mode: "bigint" }),
    invitationsCount: integer("invitations_count").default(0),
    birthDate: date("birth_date", { mode: "string" }),
    streetAddress: varchar("street_address"),
    city: varchar(),
    zipCode: varchar("zip_code"),
    state: varchar(),
    legalName: varchar("legal_name"),
    preferredName: varchar("preferred_name"),
    gumroadUserId: varchar("gumroad_user_id"),
    minimumDividendPaymentInCents: bigint("minimum_dividend_payment_in_cents", { mode: "bigint" })
      .default(1000n)
      .notNull(),
    externalId: varchar("external_id").$default(nanoid).notNull(),
    countryCode: varchar("country_code"),
    citizenshipCountryCode: varchar("citizenship_country_code"),
    signedDocuments: boolean("signed_documents").notNull().default(false),
    teamMember: boolean("team_member").notNull().default(false),
    sentInvalidTaxIdEmail: boolean("sent_invalid_tax_id_email").notNull().default(false),
    clerkId: varchar("clerk_id"),
    signupInviteLinkId: bigint("signup_invite_link_id", { mode: "number" }),
  },
  (table) => [
    index("index_users_on_confirmation_token").using("btree", table.confirmationToken.asc().nullsLast().op("text_ops")),
    index("index_users_on_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
    index("index_users_on_external_id").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
    index("index_users_on_invitation_token").using("btree", table.invitationToken.asc().nullsLast().op("text_ops")),
    index("index_users_on_invited_by").using(
      "btree",
      table.invitedByType.asc().nullsLast().op("text_ops"),
      table.invitedById.asc().nullsLast().op("text_ops"),
    ),
    index("index_users_on_invited_by_id").using("btree", table.invitedById.asc().nullsLast().op("int8_ops")),
    index("index_users_on_reset_password_token").using(
      "btree",
      table.resetPasswordToken.asc().nullsLast().op("text_ops"),
    ),
    index("index_users_on_clerk_id").using("btree", table.clerkId.asc().nullsLast().op("text_ops")),
    index("index_users_on_signup_invite_link_id").using(
      "btree",
      table.signupInviteLinkId.asc().nullsLast().op("int8_ops"),
    ),
  ],
);

export const companyInviteLinks = pgTable(
  "company_invite_links",
  {
    id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
    companyId: bigint("company_id", { mode: "bigint" }).notNull(),
    documentTemplateId: bigint("document_template_id", { mode: "bigint" }),
    token: varchar().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_on_company_id_document_template_id_57bbad7c26").using(
      "btree",
      table.companyId.asc().nullsLast().op("int8_ops"),
      table.documentTemplateId.asc().nullsLast().op("int8_ops"),
    ),
    index("index_company_invite_links_on_company_id").using("btree", table.companyId.asc().nullsLast().op("int8_ops")),
    index("index_company_invite_links_on_document_template_id").using(
      "btree",
      table.documentTemplateId.asc().nullsLast().op("int8_ops"),
    ),
    uniqueIndex("index_company_invite_links_on_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
  ],
);

export const activeStorageVariantRecordsRelations = relations(activeStorageVariantRecords, ({ one }) => ({
  activeStorageBlob: one(activeStorageBlobs, {
    fields: [activeStorageVariantRecords.blobId],
    references: [activeStorageBlobs.id],
  }),
}));

export const activeStorageBlobsRelations = relations(activeStorageBlobs, ({ many }) => ({
  activeStorageVariantRecords: many(activeStorageVariantRecords),
  attachments: many(activeStorageAttachments),
}));

export const activeStorageAttachmentsRelations = relations(activeStorageAttachments, ({ one }) => ({
  blob: one(activeStorageBlobs, {
    fields: [activeStorageAttachments.blobId],
    references: [activeStorageBlobs.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  companyAdministrators: many(companyAdministrators),
  companyContractors: many(companyContractors),
  companyInvestors: many(companyInvestors),
  companyLawyers: many(companyLawyers),
  contracts: many(contracts),
  documents: many(documents),
  invoices: many(invoices),
  wiseRecipients: many(wiseRecipients),
  invoiceApprovals: many(invoiceApprovals),
  tosAgreements: many(tosAgreements),
  userComplianceInfos: many(userComplianceInfos),
  documentSignatures: many(documentSignatures),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  administrators: many(companyAdministrators),
  contractors: many(companyContractors),
  investors: many(companyInvestors),
  lawyers: many(companyLawyers),
  shareClasses: many(shareClasses),
  updates: many(companyUpdates),
  contracts: many(contracts),
  documents: many(documents),
  invoices: many(invoices),
  integrations: many(integrations),
  optionPools: many(optionPools),
}));

export const companyContractorsRelations = relations(companyContractors, ({ one, many }) => ({
  company: one(companies, {
    fields: [companyContractors.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyContractors.userId],
    references: [users.id],
  }),
  contracts: many(contracts),
  documents: many(documents),
  invoices: many(invoices),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  company: one(companies, {
    fields: [documents.companyId],
    references: [companies.id],
  }),
  equityGrant: one(equityGrants, {
    fields: [documents.equityGrantId],
    references: [equityGrants.id],
  }),

  signatures: many(documentSignatures),
}));

export const documentSignaturesRelations = relations(documentSignatures, ({ one }) => ({
  document: one(documents, {
    fields: [documentSignatures.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentSignatures.userId],
    references: [users.id],
  }),
}));

export const equityGrantsRelations = relations(equityGrants, ({ one, many }) => ({
  activeExercise: one(equityGrantExercises, {
    fields: [equityGrants.activeExerciseId],
    references: [equityGrantExercises.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [equityGrants.companyInvestorId],
    references: [companyInvestors.id],
  }),
  contracts: many(contracts),
  documents: many(documents),
  transactions: many(equityGrantTransactions),
  vestingEvents: many(vestingEvents),
  optionPool: one(optionPools, {
    fields: [equityGrants.optionPoolId],
    references: [optionPools.id],
  }),
  vestingSchedule: one(vestingSchedules, {
    fields: [equityGrants.vestingScheduleId],
    references: [vestingSchedules.id],
  }),
}));

export const equityGrantTransactionsRelations = relations(equityGrantTransactions, ({ one }) => ({
  equityGrant: one(equityGrants, {
    fields: [equityGrantTransactions.equityGrantId],
    references: [equityGrants.id],
  }),
  invoice: one(invoices, {
    fields: [equityGrantTransactions.invoiceId],
    references: [invoices.id],
  }),
  vestingEvent: one(vestingEvents, {
    fields: [equityGrantTransactions.vestingEventId],
    references: [vestingEvents.id],
  }),
  equityGrantExercise: one(equityGrantExercises, {
    fields: [equityGrantTransactions.equityGrantExerciseId],
    references: [equityGrantExercises.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [invoices.createdById],
    references: [users.id],
  }),
  rejector: one(users, {
    fields: [invoices.rejectedById],
    references: [users.id],
  }),
  contractor: one(companyContractors, {
    fields: [invoices.companyContractorId],
    references: [companyContractors.id],
  }),
  equityGrant: one(equityGrants, {
    fields: [invoices.equityGrantId],
    references: [equityGrants.id],
  }),
  approvals: many(invoiceApprovals),
  consolidatedInvoicesInvoices: many(consolidatedInvoicesInvoices),
  payments: many(payments),
  equityGrantTransactions: many(equityGrantTransactions),
  lineItems: many(invoiceLineItems),
  expenses: many(invoiceExpenses),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  wiseRecipient: one(wiseRecipients, {
    fields: [payments.wiseRecipientId],
    references: [wiseRecipients.id],
  }),
}));

export const wiseRecipientsRelations = relations(wiseRecipients, ({ one, many }) => ({
  user: one(users, {
    fields: [wiseRecipients.userId],
    references: [users.id],
  }),
  wiseCredential: one(wiseCredentials, {
    fields: [wiseRecipients.wiseCredentialId],
    references: [wiseCredentials.id],
  }),
  payments: many(payments),
}));

export const dividendsRelations = relations(dividends, ({ one }) => ({
  company: one(companies, {
    fields: [dividends.companyId],
    references: [companies.id],
  }),
  investor: one(companyInvestors, {
    fields: [dividends.companyInvestorId],
    references: [companyInvestors.id],
  }),
  complianceInfo: one(userComplianceInfos, {
    fields: [dividends.userComplianceInfoId],
    references: [userComplianceInfos.id],
  }),
  dividendRound: one(dividendRounds, {
    fields: [dividends.dividendRoundId],
    references: [dividendRounds.id],
  }),
}));

export const balanceTransactionsRelations = relations(balanceTransactions, ({ one }) => ({
  company: one(companies, {
    fields: [balanceTransactions.companyId],
    references: [companies.id],
  }),
  consolidatedPayment: one(consolidatedPayments, {
    fields: [balanceTransactions.consolidatedPaymentId],
    references: [consolidatedPayments.id],
  }),
  payment: one(payments, {
    fields: [balanceTransactions.paymentId],
    references: [payments.id],
  }),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  company: one(companies, {
    fields: [balances.companyId],
    references: [companies.id],
  }),
}));

export const consolidatedInvoicesRelations = relations(consolidatedInvoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [consolidatedInvoices.companyId],
    references: [companies.id],
  }),
  invoices: many(consolidatedInvoicesInvoices),
  payments: many(consolidatedPayments),
}));

export const consolidatedInvoicesInvoicesRelations = relations(consolidatedInvoicesInvoices, ({ one }) => ({
  consolidatedInvoice: one(consolidatedInvoices, {
    fields: [consolidatedInvoicesInvoices.consolidatedInvoiceId],
    references: [consolidatedInvoices.id],
  }),
  invoice: one(invoices, {
    fields: [consolidatedInvoicesInvoices.invoiceId],
    references: [invoices.id],
  }),
}));

export const consolidatedPaymentsRelations = relations(consolidatedPayments, ({ one, many }) => ({
  consolidatedInvoice: one(consolidatedInvoices, {
    fields: [consolidatedPayments.consolidatedInvoiceId],
    references: [consolidatedInvoices.id],
  }),
  balanceTransactions: many(balanceTransactions),
}));

export const convertibleInvestmentsRelations = relations(convertibleInvestments, ({ one, many }) => ({
  company: one(companies, {
    fields: [convertibleInvestments.companyId],
    references: [companies.id],
  }),
  securities: many(convertibleSecurities),
}));

export const convertibleSecuritiesRelations = relations(convertibleSecurities, ({ one }) => ({
  companyInvestor: one(companyInvestors, {
    fields: [convertibleSecurities.companyInvestorId],
    references: [companyInvestors.id],
  }),
  convertibleInvestment: one(convertibleInvestments, {
    fields: [convertibleSecurities.convertibleInvestmentId],
    references: [convertibleInvestments.id],
  }),
}));

export const dividendComputationOutputsRelations = relations(dividendComputationOutputs, ({ one }) => ({
  dividendComputation: one(dividendComputations, {
    fields: [dividendComputationOutputs.dividendComputationId],
    references: [dividendComputations.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [dividendComputationOutputs.companyInvestorId],
    references: [companyInvestors.id],
  }),
}));

export const dividendComputationsRelations = relations(dividendComputations, ({ one, many }) => ({
  company: one(companies, {
    fields: [dividendComputations.companyId],
    references: [companies.id],
  }),
  outputs: many(dividendComputationOutputs),
}));

export const dividendPaymentsRelations = relations(dividendPayments, ({ many }) => ({
  dividends: many(dividendsDividendPayments),
}));

export const dividendRoundsRelations = relations(dividendRounds, ({ one, many }) => ({
  company: one(companies, {
    fields: [dividendRounds.companyId],
    references: [companies.id],
  }),
  dividends: many(dividends),
  investors: many(investorDividendRounds),
}));

export const dividendsDividendPaymentsRelations = relations(dividendsDividendPayments, ({ one }) => ({
  dividendPayment: one(dividendPayments, {
    fields: [dividendsDividendPayments.dividendPaymentId],
    references: [dividendPayments.id],
  }),
  dividend: one(dividends, {
    fields: [dividendsDividendPayments.dividendId],
    references: [dividends.id],
  }),
}));

export const investorDividendRoundsRelations = relations(investorDividendRounds, ({ one }) => ({
  companyInvestor: one(companyInvestors, {
    fields: [investorDividendRounds.companyInvestorId],
    references: [companyInvestors.id],
  }),
  dividendRound: one(dividendRounds, {
    fields: [investorDividendRounds.dividendRoundId],
    references: [dividendRounds.id],
  }),
}));

export const invoiceApprovalsRelations = relations(invoiceApprovals, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceApprovals.invoiceId],
    references: [invoices.id],
  }),
  approver: one(users, {
    fields: [invoiceApprovals.approverId],
    references: [users.id],
  }),
}));

export const invoiceExpensesRelations = relations(invoiceExpenses, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceExpenses.invoiceId],
    references: [invoices.id],
  }),
  expenseCategory: one(expenseCategories, {
    fields: [invoiceExpenses.expenseCategoryId],
    references: [expenseCategories.id],
  }),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const optionPoolsRelations = relations(optionPools, ({ one, many }) => ({
  company: one(companies, {
    fields: [optionPools.companyId],
    references: [companies.id],
  }),
  shareClass: one(shareClasses, {
    fields: [optionPools.shareClassId],
    references: [shareClasses.id],
  }),
  equityGrants: many(equityGrants),
}));

export const shareClassesRelations = relations(shareClasses, ({ one, many }) => ({
  company: one(companies, {
    fields: [shareClasses.companyId],
    references: [companies.id],
  }),
  optionPools: many(optionPools),
  holdings: many(shareHoldings),
}));

export const shareHoldingsRelations = relations(shareHoldings, ({ one, many }) => ({
  companyInvestorEntity: one(companyInvestorEntities, {
    fields: [shareHoldings.companyInvestorEntityId],
    references: [companyInvestorEntities.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [shareHoldings.companyInvestorId],
    references: [companyInvestors.id],
  }),
  equityGrant: one(equityGrants, {
    fields: [shareHoldings.equityGrantId],
    references: [equityGrants.id],
  }),
  shareClass: one(shareClasses, {
    fields: [shareHoldings.shareClassId],
    references: [shareClasses.id],
  }),
  equityGrantExerciseRequests: many(equityGrantExerciseRequests),
}));

export const taxDocumentsRelations = relations(taxDocuments, ({ one }) => ({
  company: one(companies, {
    fields: [taxDocuments.companyId],
    references: [companies.id],
  }),
  complianceInfo: one(userComplianceInfos, {
    fields: [taxDocuments.userComplianceInfoId],
    references: [userComplianceInfos.id],
  }),
}));

export const tenderOfferBidsRelations = relations(tenderOfferBids, ({ one }) => ({
  tenderOffer: one(tenderOffers, {
    fields: [tenderOfferBids.tenderOfferId],
    references: [tenderOffers.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [tenderOfferBids.companyInvestorId],
    references: [companyInvestors.id],
  }),
}));

export const tenderOffersRelations = relations(tenderOffers, ({ one, many }) => ({
  company: one(companies, {
    fields: [tenderOffers.companyId],
    references: [companies.id],
  }),
  bids: many(tenderOfferBids),
}));

export const tosAgreementsRelations = relations(tosAgreements, ({ one }) => ({
  user: one(users, {
    fields: [tosAgreements.userId],
    references: [users.id],
  }),
}));

export const userComplianceInfosRelations = relations(userComplianceInfos, ({ one, many }) => ({
  user: one(users, {
    fields: [userComplianceInfos.userId],
    references: [users.id],
  }),
  documents: many(documents),
  dividends: many(dividends),
  taxDocuments: many(taxDocuments),
}));

export const wiseCredentialsRelations = relations(wiseCredentials, ({ many }) => ({
  wiseRecipients: many(wiseRecipients),
  equityBuybackPayments: many(equityBuybackPayments),
}));

export const companyInvestorsRelations = relations(companyInvestors, ({ one, many }) => ({
  company: one(companies, {
    fields: [companyInvestors.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyInvestors.userId],
    references: [users.id],
  }),
  equityGrants: many(equityGrants),
  shareHoldings: many(shareHoldings),
  tenderBids: many(tenderOfferBids),
  convertibleSecurities: many(convertibleSecurities),
  dividendComputationOutputs: many(dividendComputationOutputs),
  dividends: many(dividends),
  equityBuybacks: many(equityBuybacks),
  equityGrantExercises: many(equityGrantExercises),
  investorDividendRounds: many(investorDividendRounds),
}));

export const vestingEventsRelations = relations(vestingEvents, ({ one, many }) => ({
  equityGrant: one(equityGrants, {
    fields: [vestingEvents.equityGrantId],
    references: [equityGrants.id],
  }),
  equityGrantTransactions: many(equityGrantTransactions),
}));

export const vestingSchedulesRelations = relations(vestingSchedules, ({ many }) => ({
  equityGrants: many(equityGrants),
}));

export const companyAdministratorsRelations = relations(companyAdministrators, ({ one }) => ({
  company: one(companies, {
    fields: [companyAdministrators.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyAdministrators.userId],
    references: [users.id],
  }),
}));

export const companyInvestorEntitiesRelations = relations(companyInvestorEntities, ({ one, many }) => ({
  company: one(companies, {
    fields: [companyInvestorEntities.companyId],
    references: [companies.id],
  }),
  equityGrants: many(equityGrants),
  shareHoldings: many(shareHoldings),
}));

export const companyLawyersRelations = relations(companyLawyers, ({ one }) => ({
  company: one(companies, {
    fields: [companyLawyers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyLawyers.userId],
    references: [users.id],
  }),
}));

export const equityBuybacksEquityBuybackPaymentsRelations = relations(
  equityBuybacksEquityBuybackPayments,
  ({ one }) => ({
    equityBuyback: one(equityBuybacks, {
      fields: [equityBuybacksEquityBuybackPayments.equityBuybackId],
      references: [equityBuybacks.id],
    }),
  }),
);

export const equityBuybackPaymentsRelations = relations(equityBuybackPayments, ({ one }) => ({
  wiseCredential: one(wiseCredentials, {
    fields: [equityBuybackPayments.wiseCredentialId],
    references: [wiseCredentials.id],
  }),
}));

export const equityBuybacksRelations = relations(equityBuybacks, ({ one, many }) => ({
  company: one(companies, {
    fields: [equityBuybacks.companyId],
    references: [companies.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [equityBuybacks.companyInvestorId],
    references: [companyInvestors.id],
  }),
  equityBuybacksEquityBuybackPayments: many(equityBuybacksEquityBuybackPayments),
}));

export const equityGrantExercisesRelations = relations(equityGrantExercises, ({ one, many }) => ({
  company: one(companies, {
    fields: [equityGrantExercises.companyId],
    references: [companies.id],
  }),
  companyInvestor: one(companyInvestors, {
    fields: [equityGrantExercises.companyInvestorId],
    references: [companyInvestors.id],
  }),
  bankAccount: one(equityExerciseBankAccounts, {
    fields: [equityGrantExercises.equityExerciseBankAccountId],
    references: [equityExerciseBankAccounts.id],
  }),
  exerciseRequests: many(equityGrantExerciseRequests),
  equityGrantTransactions: many(equityGrantTransactions),
  equityGrants: many(equityGrants),
}));

export const equityExerciseBankAccountsRelations = relations(equityExerciseBankAccounts, ({ one, many }) => ({
  company: one(companies, {
    fields: [equityExerciseBankAccounts.companyId],
    references: [companies.id],
  }),
  equityGrantExercises: many(equityGrantExercises),
}));

export const equityGrantExerciseRequestsRelations = relations(equityGrantExerciseRequests, ({ one }) => ({
  equityGrant: one(equityGrants, {
    fields: [equityGrantExerciseRequests.equityGrantId],
    references: [equityGrants.id],
  }),
  equityGrantExercise: one(equityGrantExercises, {
    fields: [equityGrantExerciseRequests.equityGrantExerciseId],
    references: [equityGrantExercises.id],
  }),
  shareHolding: one(shareHoldings, {
    fields: [equityGrantExerciseRequests.shareHoldingId],
    references: [shareHoldings.id],
  }),
}));

export const integrationRecordsRelations = relations(integrationRecords, ({ one }) => ({
  integration: one(integrations, {
    fields: [integrationRecords.integrationId],
    references: [integrations.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  records: many(integrationRecords),
  company: one(companies, {
    fields: [integrations.companyId],
    references: [companies.id],
  }),
}));

export const companyUpdatesRelations = relations(companyUpdates, ({ one }) => ({
  company: one(companies, {
    fields: [companyUpdates.companyId],
    references: [companies.id],
  }),
}));
