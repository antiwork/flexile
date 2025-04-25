import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { publicRolesRouter } from "./public";

export const rolesRouter = createRouter({
  list: companyProcedure.query(async () => {
    return [];
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async () => {
    return {
      id: "",
      name: "",
      jobDescription: "",
      activelyHiring: false,
      capitalizedExpense: false,
      payRateType: 0,
      payRateInSubunits: 0,
      trialPayRateInSubunits: 0,
      trialEnabled: false,
    };
  }),

  create: companyProcedure
    .input(z.object({
      name: z.string(),
      jobDescription: z.string().optional(),
      activelyHiring: z.boolean().optional(),
      capitalizedExpense: z.boolean().optional(),
      expenseAccountId: z.string().optional(),
      expenseCardEnabled: z.boolean().optional(),
      expenseCardSpendingLimitCents: z.number().optional(),
      trialEnabled: z.boolean().optional(),
      payRateInSubunits: z.number(),
      payRateType: z.number(),
      trialPayRateInSubunits: z.number().optional(),
    }))
    .mutation(async () => {
      return "";
    }),

  update: companyProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      jobDescription: z.string().optional(),
      activelyHiring: z.boolean().optional(),
      capitalizedExpense: z.boolean().optional(),
      expenseAccountId: z.string().optional(),
      expenseCardEnabled: z.boolean().optional(),
      expenseCardSpendingLimitCents: z.number().optional(),
      trialEnabled: z.boolean().optional(),
      payRateInSubunits: z.number().optional(),
      payRateType: z.number().optional(),
      trialPayRateInSubunits: z.number().optional(),
    }))
    .mutation(async () => {
      return;
    }),

  delete: companyProcedure.input(z.object({ id: z.string() })).mutation(async () => {
    return;
  }),
  
  applications: createRouter({
    list: companyProcedure
      .input(z.object({ companyId: z.string(), roleId: z.string() }))
      .query(() => {
        return [];
      }),
    get: companyProcedure
      .input(z.object({ companyId: z.string(), id: z.bigint() }))
      .query(() => {
        return {
          id: BigInt(0),
          name: "",
          email: "",
          description: "",
          countryCode: "",
          createdAt: new Date(),
          hoursPerWeek: 0,
          weeksPerYear: 0,
          equityPercent: 0,
          role: { id: "" },
        };
      }),
    reject: companyProcedure
      .input(z.object({ companyId: z.string(), id: z.bigint() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
  
  public: publicRolesRouter,
});
