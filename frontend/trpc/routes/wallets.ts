import { TRPCError } from "@trpc/server";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, wallets } from "@/db/schema";
import { supportedCountries } from "@/models/constants";
import { companyProcedure, createRouter } from "@/trpc";
import { isEthereumAddress } from "@/utils/isEthereumAddress";

export const walletsRouter = createRouter({
  update: companyProcedure
    .input(
      z.object({
        walletAddress: z.string().refine(isEthereumAddress, {
          message: "Invalid Ethereum address",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyInvestor) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const user = await db.query.users.findFirst({
        where: and(eq(users.id, ctx.user.id), notInArray(users.countryCode, Object.keys(supportedCountries))),
      });

      if (!user) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, user.id),
      });

      if (!wallet) {
        await db.insert(wallets).values({
          userId: user.id,
          walletAddress: input.walletAddress,
        });
        return;
      }

      await db
        .update(wallets)
        .set({
          walletAddress: input.walletAddress,
        })
        .where(eq(wallets.id, wallet.id));
    }),
});
