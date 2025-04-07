import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { companies, companyRoleRates, companyRoles } from "@/db/schema";
import { baseProcedure, createRouter } from "@/trpc";
import { assertDefined } from "@/utils/assert";

export const publicRolesRouter = createRouter({
  list: baseProcedure.input(z.object({ companyId: z.string() })).query(async ({ input }) => {
    const result = await db.query.companyRoles.findMany({
      where: and(
        eq(companyRoles.companyId, byExternalId(companies, input.companyId)),
        eq(companyRoles.activelyHiring, true),
        isNull(companyRoles.deletedAt),
      ),
      with: {
        rates: {
          columns: { payRateType: true, payRateInSubunits: true },
          orderBy: [desc(companyRoleRates.createdAt)],
          limit: 1,
        },
      },
    });
    return result.map((role) => {
      const rate = assertDefined(role.rates[0]);
      return {
        id: role.externalId,
        name: role.name,
        ...rate,
      };
    });
  }),

  get: baseProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const [result] = await db
      .select({
        ...pick(
          companyRoles,
          "name",
          "jobDescription",
          "trialEnabled",
          "activelyHiring",
          "expenseCardEnabled",
          "expenseCardSpendingLimitCents",
        ),
        id: companyRoles.externalId,
        ...pick(companyRoleRates, "payRateType", "payRateInSubunits", "trialPayRateInSubunits", "unitOfWork"),
        companyId: companies.externalId,
      })
      .from(companyRoles)
      .innerJoin(companyRoleRates, eq(companyRoleRates.companyRoleId, companyRoles.id))
      .innerJoin(companies, eq(companies.id, companyRoles.companyId))
      .where(and(eq(companyRoles.externalId, input.id), isNull(companyRoles.deletedAt)))
      .orderBy(desc(companyRoleRates.createdAt))
      .limit(1);
    if (!result) throw new TRPCError({ code: "NOT_FOUND" });
    return result;
  }),
});
