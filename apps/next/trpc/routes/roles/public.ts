import { z } from "zod";
import { baseProcedure, createRouter } from "@/trpc";

export const publicRolesRouter = createRouter({
  list: baseProcedure.input(z.object({ companyId: z.string() })).query(async () => {
    return [];
  }),

  get: baseProcedure.input(z.object({ id: z.string() })).query(async () => {
    return {
      id: "",
      name: "",
      jobDescription: "",
      trialEnabled: false,
      activelyHiring: false,
      expenseCardEnabled: false,
      expenseCardSpendingLimitCents: 0,
      payRateType: 0,
      payRateInSubunits: 0,
      trialPayRateInSubunits: 0,
      companyId: "",
    };
  }),
});
