import { utc } from "@date-fns/utc";
import { TRPCError } from "@trpc/server";
import { isFuture, isPast } from "date-fns";
import { and, count, countDistinct, desc, eq, sql, sum } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  companies,
  equityBuybackRounds,
  equityBuybacks,
  equityBuybacksEquityBuybackPayments,
  tenderOfferBids,
  tenderOffers,
} from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { tenderOffersBidsRouter } from "./bids";

const dataSchema = createInsertSchema(tenderOffers)
  .pick({
    name: true,
    startsAt: true,
    endsAt: true,
    minimumValuation: true,
    letterOfTransmittal: true,
    totalAmountInCents: true,
  })
  .extend({ attachmentKey: z.string() });

export const tenderOffersRouter = createRouter({
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled || !ctx.companyAdministrator) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db.transaction(async (tx) => {
      const blob = await tx.query.activeStorageBlobs.findFirst({
        where: eq(activeStorageBlobs.key, input.attachmentKey),
      });
      if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
      const [tenderOffer] = await tx
        .insert(tenderOffers)
        .values({
          companyId: ctx.company.id,
          name: input.name,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          minimumValuation: input.minimumValuation,
          letterOfTransmittal: input.letterOfTransmittal,
          totalAmountInCents: input.totalAmountInCents,
        })
        .returning();
      if (!tenderOffer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await tx.insert(activeStorageAttachments).values({
        name: "attachment",
        blobId: blob.id,
        recordType: "TenderOffer",
        recordId: tenderOffer.id,
      });
    });
  }),

  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.equityEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const investorFilter = !ctx.companyAdministrator
      ? eq(tenderOfferBids.companyInvestorId, ctx.companyInvestor?.id || sql`NULL`)
      : undefined;

    const bidCountSubquery = db
      .select({ tenderOfferId: tenderOfferBids.tenderOfferId, bidCount: count(tenderOfferBids.id).as("bidCount") })
      .from(tenderOfferBids)
      .where(investorFilter)
      .groupBy(tenderOfferBids.tenderOfferId)
      .as("bidCounts");

    const investorCountSubquery = db
      .select({
        tenderOfferId: tenderOfferBids.tenderOfferId,
        investorCount: countDistinct(tenderOfferBids.companyInvestorId).as("investorCount"),
      })
      .from(tenderOfferBids)
      .where(investorFilter)
      .groupBy(tenderOfferBids.tenderOfferId)
      .as("investorCounts");

    const participationSubquery = db
      .select({
        tenderOfferId: tenderOfferBids.tenderOfferId,
        participation: sum(
          sql`${tenderOfferBids.acceptedShares}::numeric * ${tenderOfferBids.sharePriceCents}::numeric`,
        ).as("participation"),
      })
      .from(tenderOfferBids)
      .where(investorFilter)
      .groupBy(tenderOfferBids.tenderOfferId)
      .as("participation");

    const settledSubquery = db
      .select({
        tenderOfferId: equityBuybackRounds.tenderOfferId,
        settled: sql`true`.as("settled"),
      })
      .from(equityBuybackRounds)
      .innerJoin(equityBuybacks, eq(equityBuybackRounds.id, equityBuybacks.equityBuybackRoundId))
      .innerJoin(
        equityBuybacksEquityBuybackPayments,
        eq(equityBuybacks.id, equityBuybacksEquityBuybackPayments.equityBuybackId),
      )
      .groupBy(equityBuybackRounds.tenderOfferId)
      .as("settledSubquery");

    return await db
      .select({
        ...pick(tenderOffers, "name", "startsAt", "endsAt", "minimumValuation", "acceptedPriceCents"),
        id: tenderOffers.externalId,
        bidCount: sql`COALESCE(${bidCountSubquery.bidCount}, 0)`.mapWith(Number),
        investorCount: sql`COALESCE(${investorCountSubquery.investorCount}, 0)`.mapWith(Number),
        participation: sql`COALESCE(${participationSubquery.participation}, 0)`.mapWith(Number),
        settled: sql`COALESCE(${settledSubquery.settled}, false)`.mapWith(Boolean),
        open: sql`(${tenderOffers.startsAt} <= now() AND ${tenderOffers.endsAt} > now())`.mapWith(Boolean),
        impliedValuation:
          sql`CASE WHEN ${tenderOffers.acceptedPriceCents} IS NOT NULL AND ${companies.fullyDilutedShares} IS NOT NULL THEN ${companies.fullyDilutedShares}::numeric * ${tenderOffers.acceptedPriceCents}::numeric ELSE NULL END`.mapWith(
            (value) => (value ? Number(value) : null),
          ),
      })
      .from(tenderOffers)
      .innerJoin(companies, eq(tenderOffers.companyId, companies.id))
      .leftJoin(bidCountSubquery, eq(tenderOffers.id, bidCountSubquery.tenderOfferId))
      .leftJoin(investorCountSubquery, eq(tenderOffers.id, investorCountSubquery.tenderOfferId))
      .leftJoin(participationSubquery, eq(tenderOffers.id, participationSubquery.tenderOfferId))
      .leftJoin(settledSubquery, eq(tenderOffers.id, settledSubquery.tenderOfferId))
      .where(eq(companies.id, ctx.company.id))
      .orderBy(desc(tenderOffers.createdAt));
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const investorFilter = !ctx.companyAdministrator
      ? eq(tenderOfferBids.companyInvestorId, ctx.companyInvestor?.id || sql`NULL`)
      : undefined;

    const tenderOffer = await db.query.tenderOffers.findFirst({
      columns: {
        id: true,
        name: true,
        externalId: true,
        startsAt: true,
        endsAt: true,
        minimumValuation: true,
        acceptedPriceCents: true,
        letterOfTransmittal: true,
      },
      where: and(eq(tenderOffers.externalId, input.id), eq(tenderOffers.companyId, ctx.company.id)),
    });

    if (!tenderOffer) throw new TRPCError({ code: "NOT_FOUND" });

    const attachment = await db.query.activeStorageAttachments.findFirst({
      where: and(
        eq(activeStorageAttachments.recordType, "TenderOffer"),
        eq(activeStorageAttachments.recordId, tenderOffer.id),
      ),
      with: { blob: { columns: { key: true, filename: true } } },
    });

    const settled = await db
      .select({ id: equityBuybackRounds.id })
      .from(equityBuybackRounds)
      .innerJoin(equityBuybacks, eq(equityBuybackRounds.id, equityBuybacks.equityBuybackRoundId))
      .innerJoin(
        equityBuybacksEquityBuybackPayments,
        eq(equityBuybacks.id, equityBuybacksEquityBuybackPayments.equityBuybackId),
      )
      .where(eq(equityBuybackRounds.tenderOfferId, tenderOffer.id))
      .limit(1)
      .then((result) => result.length > 0);

    const investorCount = await db
      .select({
        tenderOfferId: tenderOfferBids.tenderOfferId,
        investorCount: countDistinct(tenderOfferBids.companyInvestorId).as("investorCount"),
      })
      .from(tenderOfferBids)
      .where(investorFilter)
      .groupBy(tenderOfferBids.tenderOfferId)
      .then((result) => result[0]?.investorCount || 0);

    return {
      id: tenderOffer.externalId,
      ...pick(tenderOffer, [
        "name",
        "startsAt",
        "endsAt",
        "minimumValuation",
        "acceptedPriceCents",
        "letterOfTransmittal",
      ]),
      attachment: attachment?.blob || null,
      settled,
      investorCount,
      open: isPast(utc(tenderOffer.startsAt)) && isFuture(utc(tenderOffer.endsAt)),
    };
  }),
  bids: tenderOffersBidsRouter,
});
