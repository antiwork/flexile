import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, companies, companyAdministrators, users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import {
  company_administrator_stripe_microdeposit_verifications_url,
  microdeposit_verification_details_company_invoices_url,
} from "@/utils/routes";

export const companyName = (company: Pick<typeof companies.$inferSelect, "publicName" | "name">) =>
  company.publicName ?? company.name;
export const companyLogoUrl = async (id: bigint) => {
  const logo = await db.query.activeStorageAttachments.findFirst({
    where: companyLogo(id),
    with: { blob: true },
  });
  return logo?.blob ? `https://${process.env.S3_PUBLIC_BUCKET}.s3.amazonaws.com/${logo.blob.key}` : null;
};

const companyLogo = (id: bigint) =>
  and(
    eq(activeStorageAttachments.recordType, "Company"),
    eq(activeStorageAttachments.recordId, id),
    eq(activeStorageAttachments.name, "logo"),
  );

const decimalRegex = /^\d+(\.\d+)?$/u;

export const companiesRouter = createRouter({
  settings: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    return pick(ctx.company, ["taxId", "brandColor", "website", "name", "phoneNumber"]);
  }),

  listAdministrators: companyProcedure.input(z.object({ companyId: z.string() })).query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // Fetch only administrators for this company
    const admins = await db.query.companyAdministrators.findMany({
      where: eq(companyAdministrators.companyId, ctx.company.id),
      with: { user: true },
      orderBy: companyAdministrators.id, // Order by ID to match Rails primary_admin logic
    });

    // Get the primary admin (owner) - first admin by ID (matches Rails primary_admin logic)
    const primaryAdmin = admins.length > 0 ? admins[0] : null;

    // Format the admin users
    const results = admins.map((admin) => {
      const isOwner = primaryAdmin?.userId === admin.user.id;

      return {
        id: admin.user.externalId,
        email: admin.user.email,
        name: admin.user.legalName || admin.user.preferredName || admin.user.email,
        isAdmin: true,
        role: isOwner ? "Owner" : "Admin",
        isOwner,
      };
    });

    // Owner first, then by name
    return results.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }),
  update: companyProcedure
    .input(
      createUpdateSchema(companies, {
        brandColor: (z) => z.regex(/^#([0-9A-F]{6})$/iu, "Invalid hex color"),
        conversionSharePriceUsd: (z) => z.regex(decimalRegex),
        sharePriceInUsd: (z) => z.regex(decimalRegex),
        fmvPerShareInUsd: (z) => z.regex(decimalRegex),
      })
        .pick({
          name: true,
          taxId: true,
          phoneNumber: true,
          streetAddress: true,
          city: true,
          state: true,
          zipCode: true,
          publicName: true,
          website: true,
          brandColor: true,
          sharePriceInUsd: true,
          fmvPerShareInUsd: true,
          conversionSharePriceUsd: true,
        })
        .extend({ logoKey: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      await db.transaction(async (tx) => {
        await tx.update(companies).set(input).where(eq(companies.id, ctx.company.id));

        if (input.logoKey) {
          await tx.delete(activeStorageAttachments).where(companyLogo(ctx.company.id));
          const blob = await tx.query.activeStorageBlobs.findFirst({
            where: eq(activeStorageBlobs.key, input.logoKey),
          });
          if (!blob) throw new TRPCError({ code: "NOT_FOUND", message: "Logo not found" });
          await tx.insert(activeStorageAttachments).values({
            name: "logo",
            blobId: blob.id,
            recordType: "Company",
            recordId: ctx.company.id,
          });
        }
      });
    }),
  microdepositVerificationDetails: companyProcedure.query(async ({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    const response = await fetch(
      microdeposit_verification_details_company_invoices_url(ctx.company.externalId, { host: ctx.host }),
      { headers: ctx.headers },
    );
    const data = z
      .object({
        details: z
          .object({
            arrival_timestamp: z.number(),
            microdeposit_type: z.enum(["descriptor_code", "amounts"]),
            bank_account_number: z.string().nullable(),
          })
          .nullable(),
      })
      .parse(await response.json());
    return { microdepositVerificationDetails: data.details };
  }),
  microdepositVerification: companyProcedure
    .input(z.object({ code: z.string() }).or(z.object({ amounts: z.array(z.number()) })))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      const response = await fetch(
        company_administrator_stripe_microdeposit_verifications_url(ctx.company.externalId, { host: ctx.host }),
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: { "Content-Type": "application/json", ...ctx.headers },
        },
      );

      if (!response.ok) {
        const { error } = z.object({ error: z.string() }).parse(await response.json());
        throw new TRPCError({ code: "BAD_REQUEST", message: error });
      }
    }),

  revokeAdminRole: companyProcedure
    .input(z.object({ companyId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

      // Find user by external_id
      const targetUser = await db.query.users.findFirst({
        where: eq(users.externalId, input.userId),
      });
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const targetUserId = targetUser.id;

      // Check if trying to remove own admin role
      if (BigInt(ctx.userId) === targetUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      // Check if this would remove the last administrator
      const currentAdmins = await db.query.companyAdministrators.findMany({
        where: eq(companyAdministrators.companyId, ctx.company.id),
      });

      if (currentAdmins.length === 1 && currentAdmins[0]?.userId === targetUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the last administrator",
        });
      }

      // Remove admin role
      await db
        .delete(companyAdministrators)
        .where(
          and(eq(companyAdministrators.userId, targetUserId), eq(companyAdministrators.companyId, ctx.company.id)),
        );
    }),
});
