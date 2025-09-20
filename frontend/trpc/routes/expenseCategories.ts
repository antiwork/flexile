import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { company_expense_categories_url } from "@/utils/routes";

const expenseCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  expense_account_id: z.string().nullable(),
});

export const expenseCategoriesRouter = createRouter({
  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator && !ctx.companyContractor) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(company_expense_categories_url(ctx.company.externalId), {
      headers: ctx.headers,
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch expense categories",
      });
    }

    const result = z.array(expenseCategorySchema).parse(await response.json());
    return result.map((category) => ({
      ...category,
      id: BigInt(category.id),
    }));
  }),
});
