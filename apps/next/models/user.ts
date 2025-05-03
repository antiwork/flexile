import { z } from "zod";

const navLinkSchema = z.object({ label: z.string(), name: z.string() });
const addressSchema = z.object({
  street_address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip_code: z.string().nullable(),
  country: z.string().nullable(),
  country_code: z.string().nullable(),
});

const companySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  logo_url: z.string().nullable(),
  address: addressSchema,
  flags: z.array(z.string()),
  routes: z.array(navLinkSchema.extend({ subLinks: z.array(navLinkSchema).optional() })),
  requiredInvoiceApprovals: z.number(),
  equityCompensationEnabled: z.boolean(),
  completedPaymentMethodSetup: z.boolean(),
  paymentProcessingDays: z.number(),
  createdAt: z.string(),
  fullyDilutedShares: z.number().nullable(),
  valuationInDollars: z.number().nullable(),
  sharePriceInUsd: z.string().nullable(),
  conversionSharePriceUsd: z.string().nullable(),
  exercisePriceInUsd: z.string().nullable(),
  contractorCount: z.number().nullable(),
  investorCount: z.number().nullable(),
  primaryAdminName: z.string().nullable(),
  isTrusted: z.boolean(),
});

export const currentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: addressSchema,
  currentCompanyId: z.string().nullable(),
  onboardingPath: z.string().nullable(),
  companies: z.array(companySchema),
  email: z.string(),
  preferredName: z.string().nullable(),
  legalName: z.string().nullable(),
  billingEntityName: z.string().nullable(),
  hasPayoutMethod: z.boolean(),
  roles: z.object({
    administrator: z.object({ id: z.string(), isInvited: z.boolean(), isBoardMember: z.boolean() }).optional(),
    lawyer: z.object({ id: z.string() }).optional(),
    investor: z
      .object({
        id: z.string(),
        hasDocuments: z.boolean(),
        investedInAngelListRuv: z.boolean(),
        hasGrants: z.boolean(),
        hasShares: z.boolean(),
        hasConvertibles: z.boolean(),
      })
      .optional(),
    worker: z
      .object({
        id: z.string(),
        hasDocuments: z.boolean(),
        endedAt: z.string().nullable(),
        payRateType: z.enum(["hourly", "project_based", "salary"]),
        inviting_company: z.boolean(),
        role: z.object({ name: z.string() }),
        hoursPerWeek: z.number().nullable(),
        payRateInSubunits: z.number().nullable(),
      })
      .optional(),
  }),
});

export type Company = z.infer<typeof companySchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
