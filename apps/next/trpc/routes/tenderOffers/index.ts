import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, companies, tenderOffers } from "@/db/schema";
import { companyProcedure, createRouter, getS3Url } from "@/trpc";
import { tenderOffersBidsRouter } from "./bids";

const dataSchema = createInsertSchema(tenderOffers)
  .pick({
    startsAt: true,
    endsAt: true,
    startingValuation: true,
  })
  .extend({ documentPackageKey: z.string() });

export const tenderOffersRouter = createRouter({
  create: companyProcedure.input(dataSchema.required()).mutation(async ({ ctx, input }) => {
    if (!ctx.company.tenderOffersEnabled || !ctx.companyAdministrator) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db.transaction(async (tx) => {
      const blob = await tx.query.activeStorageBlobs.findFirst({
        where: eq(activeStorageBlobs.key, input.documentPackageKey),
      });
      if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Document package not found" });
      const [tenderOffer] = await tx
        .insert(tenderOffers)
        .values({
          companyId: ctx.company.id,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          startingValuation: input.startingValuation,
        })
        .returning();
      if (!tenderOffer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await tx.insert(activeStorageAttachments).values({
        name: "document_package",
        blobId: blob.id,
        recordType: "TenderOffer",
        recordId: tenderOffer.id,
      });
    });
  }),

  list: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    return await db
      .select({
        ...pick(tenderOffers, "startsAt", "endsAt", "startingValuation"),
        id: tenderOffers.externalId,
      })
      .from(tenderOffers)
      .innerJoin(companies, eq(tenderOffers.companyId, companies.id))
      .where(eq(companies.id, ctx.company.id))
      .orderBy(desc(tenderOffers.createdAt));
  }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    if (!ctx.company.tenderOffersEnabled || (!ctx.companyAdministrator && !ctx.companyInvestor))
      throw new TRPCError({ code: "FORBIDDEN" });

    const tenderOffer = await db.query.tenderOffers.findFirst({
      columns: { id: true, startsAt: true, endsAt: true, startingValuation: true },
      where: and(eq(tenderOffers.externalId, input.id), eq(tenderOffers.companyId, ctx.company.id)),
    });

    if (!tenderOffer) throw new TRPCError({ code: "NOT_FOUND" });

    const attachment = await db.query.activeStorageAttachments.findFirst({
      where: sql`record_type = 'TenderOffer' AND record_id = ${tenderOffer.id}`,
      with: { blob: true },
    });

    return {
      ...pick(tenderOffer, ["startsAt", "endsAt", "startingValuation"]),
      documentPackage: attachment ? await getS3Url(attachment.blob.key, attachment.blob.filename) : null,
    };
  }),
  bids: tenderOffersBidsRouter,
});
