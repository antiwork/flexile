import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/db";
import { companyAdministrators, companies, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import superjson from "superjson";

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const middleware = t.middleware;
export const procedure = t.procedure;

export interface AdministratorContext {
  session: {
    userId: string;
  };
  user: typeof users.$inferSelect;
  company: typeof companies.$inferSelect;
  companyAdministrator: typeof companyAdministrators.$inferSelect;
}

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const userId = BigInt(ctx.session.userId);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user,
    },
  });
});

export const administratorProcedure = procedure.use(isAdmin);
