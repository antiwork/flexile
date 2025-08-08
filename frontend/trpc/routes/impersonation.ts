import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { withRoles } from "./users/helpers";

export const impersonationRouter = createRouter({
  canImpersonate: companyProcedure.query(async ({ ctx }) => ({
    allowed: !!ctx.companyAdministrator,
  })),

  startImpersonation: companyProcedure
    .input(z.object({ targetEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can impersonate users" });
      }

      const targetUser = await db.query.users.findFirst({
        where: eq(users.email, input.targetEmail),
        with: withRoles(ctx.company.id),
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const hasRoleInCompany = [
        targetUser.companyAdministrators,
        targetUser.companyContractors,
        targetUser.companyInvestors,
        targetUser.companyLawyers,
      ].some((roles) => roles.length > 0);

      if (!hasRoleInCompany) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not associated with this company",
        });
      }

      if (targetUser.email === ctx.user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot impersonate yourself",
        });
      }

      if (targetUser.companyAdministrators.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot impersonate other administrators",
        });
      }

      return {
        targetEmail: input.targetEmail,
        targetName: targetUser.preferredName || targetUser.legalName || targetUser.email,
      };
    }),

  endImpersonation: companyProcedure.query(({ ctx }) => {
    const userWithImpersonation = ctx.user as any;

    if (!userWithImpersonation.impersonatedBy) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Not currently impersonating any user",
      });
    }

    return {
      redirectTo: "/settings/administrator/impersonate",
      originalAdmin: userWithImpersonation.impersonatedBy,
    };
  }),
});
