import { TRPCError } from "@trpc/server";
import { and, desc, eq, exists, gte, lte, sum } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { VESTED_SHARES_CLASS } from "@/app/equity/tender_offers";
import { byExternalId, db } from "@/db";
import { companyInvestors, shareClasses, shareHoldings, tenderOfferBids, tenderOffers } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { sumVestedShares } from "@/trpc/routes/equityGrants";
import { simpleUser } from "@/trpc/routes/users";

export const tenderOffersBidsRouter = createRouter({
  list: companyProcedure
    .input(
      z.object({
        tenderOfferId: z.string(),
        investorId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (
        !ctx.company.tenderOffersEnabled ||
        (!ctx.companyAdministrator && (!ctx.companyInvestor || ctx.companyInvestor.externalId !== input.investorId))
      )
        throw new TRPCError({ code: "FORBIDDEN" });

      const where = and(
        eq(
          tenderOfferBids.tenderOfferId,
          byExternalId(tenderOffers, input.tenderOfferId, eq(tenderOffers.companyId, ctx.company.id)),
        ),
        input.investorId
          ? eq(tenderOfferBids.companyInvestorId, byExternalId(companyInvestors, input.investorId))
          : undefined,
      );

      const bidsQuery = await db.query.tenderOfferBids.findMany({
        where,
        with: { companyInvestor: { with: { user: { columns: simpleUser.columns } } } },
        orderBy: desc(tenderOfferBids.createdAt),
      });
      return bidsQuery.map((bid) => ({
        ...pick(bid, ["sharePriceCents", "shareClass", "numberOfShares"]),
        id: bid.externalId,
        companyInvestor: { user: simpleUser(bid.companyInvestor.user) },
      }));
    }),
  create: companyProcedure
    .input(
      z.object({
        tenderOfferId: z.string(),
        numberOfShares: z.number().positive(),
        sharePriceCents: z.number().positive(),
        shareClass: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.company.tenderOffersEnabled || !ctx.companyInvestor) throw new TRPCError({ code: "FORBIDDEN" });

      const tenderOffer = await db.query.tenderOffers.findFirst({
        where: and(
          eq(tenderOffers.externalId, input.tenderOfferId),
          eq(tenderOffers.companyId, ctx.company.id),
          lte(tenderOffers.startsAt, new Date()),
          gte(tenderOffers.endsAt, new Date()),
        ),
      });
      if (!tenderOffer) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.shareClass === VESTED_SHARES_CLASS) {
        if (input.numberOfShares > (await sumVestedShares(ctx.company.id, ctx.companyInvestor.id)))
          throw new TRPCError({ code: "BAD_REQUEST" });
      } else {
        const [count] = await db
          .select({ count: sum(shareHoldings.numberOfShares).mapWith(Number) })
          .from(shareHoldings)
          .innerJoin(shareClasses, eq(shareHoldings.shareClassId, shareClasses.id))
          .where(
            and(
              eq(shareHoldings.companyInvestorId, ctx.companyInvestor.id),
              eq(shareClasses.companyId, ctx.company.id),
              eq(shareClasses.name, input.shareClass),
            ),
          );
        if (!count || count.count < input.numberOfShares) throw new TRPCError({ code: "BAD_REQUEST" });
      }

      await db.insert(tenderOfferBids).values({
        tenderOfferId: tenderOffer.id,
        companyInvestorId: ctx.companyInvestor.id,
        numberOfShares: `${input.numberOfShares}`,
        sharePriceCents: input.sharePriceCents,
        shareClass: input.shareClass,
      });
    }),

  destroy: companyProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    if (!ctx.company.tenderOffersEnabled || !ctx.companyInvestor) throw new TRPCError({ code: "FORBIDDEN" });

    const result = await db
      .delete(tenderOfferBids)
      .where(
        and(
          eq(tenderOfferBids.externalId, input.id),
          eq(tenderOfferBids.companyInvestorId, ctx.companyInvestor.id),
          exists(
            db
              .select()
              .from(tenderOffers)
              .where(
                and(
                  eq(tenderOffers.id, tenderOfferBids.tenderOfferId),
                  eq(tenderOffers.companyId, ctx.company.id),
                  lte(tenderOffers.startsAt, new Date()),
                  gte(tenderOffers.endsAt, new Date()),
                ),
              ),
          ),
        ),
      )
      .returning();
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),
});
