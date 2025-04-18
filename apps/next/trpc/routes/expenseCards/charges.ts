import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { companyContractors, companyRoles, expenseCardCharges, expenseCards, users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { simpleUser } from "@/trpc/routes/users";

export const expenseCardChargesRouter = createRouter({
  list: companyProcedure
    .input(
      z.object({
        contractorId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.company.expenseCardsEnabled) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!ctx.companyAdministrator && input.contractorId !== ctx.companyContractor?.externalId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const query = db
        .select({
          expenseCardCharge: pick(expenseCardCharges, [
            "id",
            "totalAmountInCents",
            "description",
            "processorTransactionData",
            "createdAt",
            "companyId",
          ]),
          contractor: pick(companyContractors, ["externalId"]),
          role: pick(companyRoles, ["name"]),
          user: users,
        })
        .from(expenseCardCharges)
        .innerJoin(expenseCards, eq(expenseCardCharges.expenseCardId, expenseCards.id))
        .innerJoin(companyContractors, eq(expenseCards.companyContractorId, companyContractors.id))
        .innerJoin(users, eq(companyContractors.userId, users.id))
        .innerJoin(companyRoles, eq(companyContractors.companyRoleId, companyRoles.id))
        .orderBy(desc(expenseCardCharges.createdAt))
        .where(
          and(
            input.contractorId ? eq(companyContractors.externalId, input.contractorId) : undefined,
            eq(expenseCardCharges.companyId, ctx.company.id),
          ),
        );

      const total = await db.$count(query.as("expenseCardCharges"));
      const rows = await query;

      const items = rows.map((row) => ({
        ...row.expenseCardCharge,
        contractor: {
          id: row.contractor.externalId,
          role: row.role.name,
          user: simpleUser(row.user),
        },
      }));

      return { items, total };
    }),
});
