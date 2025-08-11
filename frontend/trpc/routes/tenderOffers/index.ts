import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, companies, tenderOffers } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { tenderOffersBidsRouter } from "./bids";

const dataSchema = createInsertSchema(tenderOffers)
  .pick({
    startsAt: true,
    endsAt: true,
    minimumValuation: true,
    letterOfTransmittal: true,
  })
  .extend({ attachmentKey: z.string(), letterOfTransmittal: z.string() });

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
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          minimumValuation: input.minimumValuation,
          letterOfTransmittal: input.letterOfTransmittal,
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

    return await db
      .select({
        ...pick(tenderOffers, "startsAt", "endsAt", "minimumValuation"),
        id: tenderOffers.externalId,
      })
      .from(tenderOffers)
      .innerJoin(companies, eq(tenderOffers.companyId, companies.id))
      .where(eq(companies.id, ctx.company.id))
      .orderBy(desc(tenderOffers.createdAt));
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.equityEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const tenderOffer = await db.query.tenderOffers.findFirst({
      columns: { id: true, startsAt: true, endsAt: true, minimumValuation: true, letterOfTransmittal: true },
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
      ...pick(tenderOffer, ["startsAt", "endsAt", "minimumValuation", "letterOfTransmittal"]),
      attachment: attachment?.blob,
    };
  }),
  bids: tenderOffersBidsRouter,
});
