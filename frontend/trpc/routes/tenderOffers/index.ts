import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, companies, tenderOfferBids, tenderOffers } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { tenderOffersBidsRouter } from "./bids";

const dataSchema = createInsertSchema(tenderOffers)
  .pick({
    name: true,
    startsAt: true,
    endsAt: true,
    minimumValuation: true,
  })
  .extend({ attachmentKey: z.string() });

export const tenderOffersRouter = createRouter({
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.company.tenderOffersEnabled || !ctx.companyAdministrator) {
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
    if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const currentUserInvestorId = ctx.companyInvestor?.id;

    return await db
      .select({
        ...pick(tenderOffers, "name", "startsAt", "endsAt", "minimumValuation", "acceptedPriceCents"),
        id: tenderOffers.externalId,
        bidCount: count(tenderOfferBids.id),
        participation: currentUserInvestorId
          ? sql<number>`COALESCE(SUM(CASE WHEN ${tenderOfferBids.companyInvestorId} = ${currentUserInvestorId} THEN ${tenderOfferBids.acceptedShares} * ${tenderOffers.acceptedPriceCents} ELSE 0 END), 0)`
          : sql<number>`0`,
      })
      .from(tenderOffers)
      .innerJoin(companies, eq(tenderOffers.companyId, companies.id))
      .leftJoin(tenderOfferBids, eq(tenderOfferBids.tenderOfferId, tenderOffers.id))
      .where(eq(companies.id, ctx.company.id))
      .groupBy(tenderOffers.id)
      .orderBy(desc(tenderOffers.createdAt));
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const tenderOffer = await db.query.tenderOffers.findFirst({
      columns: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        minimumValuation: true,
        acceptedPriceCents: true,
      },
      with: {
        equityBuybackRounds: {
          columns: {
            status: true,
          },
        },
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

    return {
      ...pick(tenderOffer, [
        "name",
        "startsAt",
        "endsAt",
        "minimumValuation",
        "acceptedPriceCents",
        "equityBuybackRounds",
      ]),
      attachment: attachment?.blob,
    };
  }),
  bids: tenderOffersBidsRouter,
});
